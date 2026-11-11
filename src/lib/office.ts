import { airtableListFresh } from "@/lib/airtable/client";

/** Office task board: a People roster + Tasks assigned to people, grouped by department/role. */
const BASE = "appiMw8gpaLv2WITA";
const PEOPLE_TABLE = "tblxQzGL0B05AYjfZ";
const TASKS_TABLE = "tblToOXvFt2rHZEh0";

export type Person = { id: string; name: string; department: string; role: string; active: boolean; order: number };
export type Task = {
  id: string;
  task: string;
  description: string;
  department: string;
  role: string;
  assignee: string;
  done: boolean;
  completedAt: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  reviewNote: string;
  result: string;
};

export const TASK_STATUSES = ["Up Next", "Doing", "Blocked", "Review", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = "High" | "Normal" | "Low";
/** Assignee name for work queued to the AI (Claude via the Berlin connector). */
export const AI_ASSIGNEE = "AI";

function asStatus(v: unknown, done: boolean): TaskStatus {
  if (done) return "Done";
  return (TASK_STATUSES as readonly string[]).includes(String(v)) && v !== "Done" ? (v as TaskStatus) : "Up Next";
}

function pat() {
  const p = process.env.AIRTABLE_PAT;
  if (!p) throw new Error("Missing AIRTABLE_PAT");
  return p;
}

async function write(table: string, method: "POST" | "PATCH", records: unknown[]) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}`, {
    method,
    headers: { Authorization: `Bearer ${pat()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable ${method} ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function remove(table: string, id: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${pat()}` },
  });
  if (!res.ok) throw new Error(`Airtable DELETE ${table}/${id} failed (${res.status})`);
  return res.json();
}

export async function getOffice(): Promise<{ people: Person[]; tasks: Task[] }> {
  const [peopleRecs, taskRecs] = await Promise.all([
    airtableListFresh(BASE, PEOPLE_TABLE),
    airtableListFresh(BASE, TASKS_TABLE),
  ]);
  const people: Person[] = peopleRecs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        name: String(f.Name ?? ""),
        department: String(f.Department ?? "General"),
        role: String(f.Role ?? "Team"),
        active: f.Active !== false,
        order: Number(f.Order ?? 999),
      };
    })
    .filter((p) => p.name)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const tasks: Task[] = taskRecs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        task: String(f.Task ?? ""),
        description: String(f.Description ?? ""),
        department: String(f.Department ?? "General"),
        role: String(f.Role ?? "Team"),
        assignee: String(f.Assignee ?? ""),
        done: f.Done === true,
        completedAt: f["Completed At"] ? String(f["Completed At"]) : null,
        status: asStatus(f.Status, f.Done === true),
        priority: (["High", "Normal", "Low"].includes(String(f.Priority)) ? f.Priority : "Normal") as TaskPriority,
        reviewNote: String(f["Review Note"] ?? ""),
        result: String(f.Result ?? ""),
      };
    })
    .filter((t) => t.task);

  return { people, tasks };
}

export async function addTask(input: {
  task: string;
  description?: string;
  department: string;
  role: string;
  assignee: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}) {
  const res = await write(TASKS_TABLE, "POST", [
    {
      fields: {
        Task: input.task,
        Description: input.description ?? "",
        Department: input.department,
        Role: input.role,
        Assignee: input.assignee,
        Done: false,
        Status: input.status && input.status !== "Done" ? input.status : "Up Next",
        Priority: input.priority ?? "Normal",
      },
    },
  ]);
  return (res as { records?: { id: string }[] }).records?.[0]?.id ?? null;
}

/** Move a task between lanes. Done also checks it off; leaving Done reopens it. */
export async function setTaskStatus(id: string, status: TaskStatus, extra: { result?: string; reviewNote?: string } = {}) {
  const fields: Record<string, unknown> = {
    Status: status,
    Done: status === "Done",
    "Completed At": status === "Done" ? new Date().toISOString() : null,
  };
  if (extra.result !== undefined) fields.Result = extra.result;
  if (extra.reviewNote !== undefined) fields["Review Note"] = extra.reviewNote;
  await write(TASKS_TABLE, "PATCH", [{ id, fields }]);
}

/** Approve AI work waiting in Review: it's done. */
export async function approveTask(id: string, note = "") {
  await setTaskStatus(id, "Done", { reviewNote: note ? `Approved: ${note}` : "Approved" });
  // Launch flows ("Flow · <name> · <n>. <step>"): approving a step queues the next one for the AI.
  const { tasks } = await getOffice();
  const done = tasks.find((t) => t.id === id);
  const m = done?.task.match(/^Flow · (.*) · (\d+)\. /);
  if (!m) return;
  const next = tasks.find((t) => t.task.startsWith(`Flow · ${m[1]} · ${Number(m[2]) + 1}. `));
  if (next && !next.done && next.status === "Blocked") await setTaskStatus(next.id, "Up Next");
}

/** Deny AI work: back to the queue with the reason, so the AI redoes it. */
export async function denyTask(id: string, note = "") {
  await setTaskStatus(id, "Up Next", { reviewNote: note ? `Denied: ${note}` : "Denied" });
}

export async function updateTask(
  id: string,
  fields: { task?: string; description?: string; assignee?: string; department?: string; role?: string; priority?: TaskPriority },
) {
  const f: Record<string, unknown> = {};
  if (fields.task !== undefined) f.Task = fields.task;
  if (fields.description !== undefined) f.Description = fields.description;
  if (fields.assignee !== undefined) f.Assignee = fields.assignee;
  if (fields.department !== undefined) f.Department = fields.department;
  if (fields.role !== undefined) f.Role = fields.role;
  if (fields.priority !== undefined) f.Priority = fields.priority;
  await write(TASKS_TABLE, "PATCH", [{ id, fields: f }]);
}

export async function toggleTask(id: string, done: boolean) {
  await write(TASKS_TABLE, "PATCH", [
    { id, fields: { Done: done, Status: done ? "Done" : "Up Next", "Completed At": done ? new Date().toISOString() : null } },
  ]);
}

export async function deleteTask(id: string) {
  await remove(TASKS_TABLE, id);
}

export async function addPerson(input: { name: string; department: string; role: string }) {
  await write(PEOPLE_TABLE, "POST", [
    { fields: { Name: input.name, Department: input.department, Role: input.role, Active: true, Order: 500 } },
  ]);
}

export async function deletePerson(id: string) {
  await remove(PEOPLE_TABLE, id);
}
