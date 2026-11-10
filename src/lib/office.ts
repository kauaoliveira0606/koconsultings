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
};

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
}) {
  await write(TASKS_TABLE, "POST", [
    {
      fields: {
        Task: input.task,
        Description: input.description ?? "",
        Department: input.department,
        Role: input.role,
        Assignee: input.assignee,
        Done: false,
      },
    },
  ]);
}

export async function toggleTask(id: string, done: boolean) {
  await write(TASKS_TABLE, "PATCH", [
    { id, fields: { Done: done, "Completed At": done ? new Date().toISOString() : null } },
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
