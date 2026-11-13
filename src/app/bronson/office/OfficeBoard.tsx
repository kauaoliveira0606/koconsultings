"use client";

import { useState } from "react";
import useSWR from "swr";

type Person = { id: string; name: string; department: string; role: string; active: boolean; order: number };
type Task = {
  id: string;
  task: string;
  description: string;
  department: string;
  role: string;
  assignee: string;
  done: boolean;
  completedAt: string | null;
  status: "Up Next" | "Doing" | "Blocked" | "Review" | "Done";
  priority: "High" | "Normal" | "Low";
  reviewNote: string;
  result: string;
};
type OfficeData = { people: Person[]; tasks: Task[] };

const AI = "AI";

const LANES: { status: Task["status"]; title: string; hint: string; color: string }[] = [
  { status: "Review", title: "Needs your review", hint: "The AI did it. Approve or deny.", color: "#db2777" },
  { status: "Doing", title: "Doing", hint: "In progress now.", color: "#2563eb" },
  { status: "Up Next", title: "Queued for AI", hint: "Waiting for the AI to pick up.", color: "#7c3aed" },
  { status: "Blocked", title: "Blocked", hint: "Needs something from a person.", color: "#e11d48" },
];
const PRIORITY_COLOR: Record<Task["priority"], string> = { High: "#e11d48", Normal: "#2563eb", Low: "#94a3b8" };

/** Manos-style AI work board: what the AI is doing, what's queued for it, what's blocked, and what waits for your approval. */
function AiQueue({ tasks, busy, post, onQueue }: { tasks: Task[]; busy: boolean; post: (p: Record<string, unknown>) => Promise<void>; onQueue: () => void }) {
  const [denying, setDenying] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const review = tasks.filter((t) => t.status === "Review").length;
  const [working, setWorking] = useState(false);
  async function workNow() {
    setWorking(true);
    try {
      await fetch("/api/bronson/office/run", { method: "POST" });
      await post({ action: "refresh" });
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="mb-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">AI queue</h2>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            {tasks.length} open{review ? ` · ${review} waiting for your review` : ""}. The AI worker picks up the next queued task every hour from 8 AM to 9 PM ET and puts the result in Review.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={workNow} disabled={working} className="rounded-lg border border-[var(--panel-border)] px-3.5 py-2 text-sm font-semibold disabled:opacity-50">{working ? "Working… (1-4 min)" : "Work next task now"}</button>
          <button onClick={onQueue} className="rounded-lg bg-[#7c3aed] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">Queue for AI</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => {
          const list = tasks
            .filter((t) => t.status === lane.status)
            .sort((a, b) => ["High", "Normal", "Low"].indexOf(a.priority) - ["High", "Normal", "Low"].indexOf(b.priority));
          return (
            <div key={lane.status} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: lane.color }} />
                <span className="text-[14px] font-bold text-[var(--text-strong)]">{lane.title}</span>
                <span className="ml-auto rounded-full bg-[var(--panel-bg)] px-2 text-[12px] font-semibold text-[var(--text-muted)]">{list.length}</span>
              </div>
              <div className="space-y-2.5">
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-sm">
                    <button className="block w-full text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} title={`${t.priority} priority`} />
                        <span className="text-[14px] font-semibold leading-snug text-[var(--text-strong)]">{t.task}</span>
                      </div>
                      <div className="mt-1 pl-4 text-[11px] text-[var(--text-muted)]">{t.assignee || "Unassigned"} · {t.department}</div>
                    </button>
                    {open === t.id || lane.status === "Review" ? (
                      <div className="mt-2 space-y-2 pl-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t.description ? <p className="whitespace-pre-wrap">{t.description}</p> : null}
                        {t.result ? <p className="whitespace-pre-wrap rounded-md bg-[var(--panel-subtle)] p-2 text-[var(--text-strong)]"><span className="font-semibold">Result: </span>{t.result}</p> : null}
                        {t.reviewNote ? <p className="text-[12px] italic">{t.reviewNote}</p> : null}
                      </div>
                    ) : null}
                    {lane.status === "Review" ? (
                      denying === t.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What should change?"
                            className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" />
                          <div className="flex gap-2">
                            <button disabled={busy} onClick={async () => { await post({ action: "deny", id: t.id, note }); setDenying(null); setNote(""); }}
                              className="rounded-md bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">Send back</button>
                            <button onClick={() => setDenying(null)} className="px-2 text-[12px] text-[var(--text-muted)]">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button disabled={busy} onClick={() => post({ action: "approve", id: t.id })}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">Approve</button>
                          <button disabled={busy} onClick={() => { setDenying(t.id); setNote(""); }}
                            className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-strong)]">Deny</button>
                        </div>
                      )
                    ) : (
                      <div className="mt-2 pl-4">
                        <select value={t.status} disabled={busy} onChange={(e) => post({ action: "setStatus", id: t.id, status: e.target.value })}
                          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[11px] text-[var(--text-muted)]">
                          {LANES.map((l) => <option key={l.status} value={l.status}>{l.title}</option>)}
                          <option value="Done">Done</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                {list.length === 0 ? <p className="px-1 py-2 text-[12px] text-[var(--text-muted)]">{lane.hint}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

export function OfficeBoard() {
  const { data, mutate, isLoading } = useSWR<OfficeData>("/api/bronson/office", fetcher, { refreshInterval: 60_000 });
  const [composer, setComposer] = useState<false | "task" | "ai">(false);
  const [busy, setBusy] = useState(false);

  const people = data?.people ?? [];
  const tasks = data?.tasks ?? [];
  const departments = [...new Set([...people.map((p) => p.department), ...tasks.map((t) => t.department)])].filter(Boolean);
  const roles = [...new Set([...people.map((p) => p.role), ...tasks.map((t) => t.role)])].filter(Boolean);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/bronson/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) mutate(await res.json(), false);
    } finally {
      setBusy(false);
    }
  }

  const aiOpen = tasks.filter((t) => !t.done && (t.assignee === AI || t.status === "Review" || t.status === "Blocked"));

  return (
    <div>
    <div className="mx-auto max-w-2xl">
      {isLoading ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}
      {composer ? (
        <TaskComposer people={people} departments={departments} roles={roles} forAi={composer === "ai"} onClose={() => setComposer(false)}
          onAdd={async (payload) => { await post({ action: "addTask", ...payload }); setComposer(false); }} />
      ) : null}
    </div>
    <div className="mt-14">
      <AiQueue tasks={aiOpen} busy={busy} post={post} onQueue={() => setComposer("ai")} />
    </div>
    </div>
  );
}

function TaskComposer({ people, departments, roles, forAi, onAdd, onClose }: { people: Person[]; departments: string[]; roles: string[]; forAi?: boolean; onAdd: (p: { task: string; description: string; department: string; role: string; assignee: string; priority: string }) => Promise<void>; onClose: () => void }) {
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState(forAi ? "Marketing" : departments[0] ?? "");
  const [role, setRole] = useState(forAi ? "AI" : "");
  const [assignee, setAssignee] = useState(forAi ? AI : "");
  const [priority, setPriority] = useState("Normal");
  const input = "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[var(--text-strong)]">{forAi ? "Queue for AI" : "New task"}</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">Close</button></div>
        <div className="mt-4 space-y-2.5">
          <input autoFocus value={task} onChange={(e) => setTask(e.target.value)} placeholder="Task name" className={input} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (what exactly it is)" rows={3} className={`${input} min-h-[80px] resize-y leading-relaxed`} />
          <div className="flex gap-2">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" list="comp-depts" className={input} />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" list="comp-roles" className={input} />
          </div>
          <datalist id="comp-depts">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          <datalist id="comp-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
          <div className="flex gap-2">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={input}>
              <option value="">Unassigned</option>
              <option value={AI}>AI (Claude)</option>
              {people.map((p) => <option key={p.id} value={p.name}>{p.name}, {p.role}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={input}>
              <option>High</option><option>Normal</option><option>Low</option>
            </select>
          </div>
          <button disabled={!task.trim() || !department.trim() || !role.trim()}
            onClick={() => onAdd({ task: task.trim(), description: description.trim(), department: department.trim(), role: role.trim(), assignee, priority })}
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add task</button>
        </div>
      </div>
    </div>
  );
}

