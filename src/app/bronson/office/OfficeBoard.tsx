"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";

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
};
type OfficeData = { people: Person[]; tasks: Task[] };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function OfficeBoard() {
  const { data, mutate, isLoading } = useSWR<OfficeData>("/api/bronson/office", fetcher, { refreshInterval: 60_000 });
  const [managePeople, setManagePeople] = useState(false);
  const [composer, setComposer] = useState(false);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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

  const structure = useMemo(() => {
    const depts = new Map<string, Map<string, { people: Person[]; tasks: Task[] }>>();
    const ensure = (dept: string, role: string) => {
      if (!depts.has(dept)) depts.set(dept, new Map());
      const r = depts.get(dept)!;
      if (!r.has(role)) r.set(role, { people: [], tasks: [] });
      return r.get(role)!;
    };
    for (const p of people) if (p.active) ensure(p.department, p.role).people.push(p);
    for (const t of tasks) if (!t.done) ensure(t.department, t.role).tasks.push(t);
    return [...depts.entries()].map(([department, r]) => ({
      department,
      roles: [...r.entries()].map(([role, g]) => ({ role, ...g })),
    }));
  }, [people, tasks]);

  const completed = tasks.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const openCount = tasks.filter((t) => !t.done).length;
  const empty = !isLoading && structure.length === 0 && completed.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader title="Office" subtitle={`${openCount} open · ${completed.length} done · grouped by department and role.`} />
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setComposer(true)}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            New task
          </button>
          <button
            onClick={() => setManagePeople(true)}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]"
          >
            Manage people
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      {empty ? (
        <Panel className="flex flex-col items-center py-14 text-center">
          <div className="text-base font-semibold text-[var(--text-strong)]">No tasks yet</div>
          <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">Add the people who work in the company, then create tasks and assign them. Completed tasks drop to the bottom.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setComposer(true)} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">New task</button>
            <button onClick={() => setManagePeople(true)} className="rounded-lg border border-[var(--panel-border)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)]">Add people</button>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-12">
        {structure.map((dept) => (
          <section key={dept.department}>
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-[var(--text-strong)]">{dept.department}</h2>
            <div className="space-y-9">
              {dept.roles.map((role) => {
                const key = `${dept.department}|${role.role}`;
                return (
                  <div key={key}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 border-b border-[var(--panel-border)] pb-2">
                      <span className="text-[15px] font-semibold text-[var(--text-strong)]">{role.role}</span>
                      {role.people.map((p) => (
                        <span key={p.id} className="rounded-full bg-[var(--panel-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">{p.name}</span>
                      ))}
                    </div>

                    <ul>
                      {role.tasks.map((t) =>
                        editing === t.id ? (
                          <EditTask key={t.id} task={t} people={people} busy={busy}
                            onCancel={() => setEditing(null)}
                            onSave={async (fields) => { await post({ action: "updateTask", id: t.id, ...fields }); setEditing(null); }} />
                        ) : (
                          <li key={t.id} className="group flex items-start gap-3.5 border-b border-[var(--panel-border)] py-5 last:border-0">
                            <button aria-label="Complete" disabled={busy} onClick={() => post({ action: "toggle", id: t.id, done: true })}
                              className="mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-[var(--panel-border)] transition-colors hover:border-[var(--accent)]" />
                            <div className="min-w-0 flex-1 cursor-text" onClick={() => setEditing(t.id)}>
                              <div className="text-base font-medium leading-snug text-[var(--text-strong)]">{t.task}</div>
                              {t.description ? <div className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{t.description}</div> : null}
                            </div>
                            {t.assignee ? (
                              <span title={t.assignee} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[10px] font-bold text-[var(--accent)]">{initials(t.assignee)}</span>
                            ) : null}
                            <div className="mt-0.5 flex shrink-0 gap-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button aria-label="Edit" onClick={() => setEditing(t.id)} className="text-[var(--text-muted)] hover:text-[var(--text-strong)]">✎</button>
                              <button aria-label="Delete" onClick={() => post({ action: "deleteTask", id: t.id })} className="text-[var(--text-muted)] hover:text-rose-500">✕</button>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>

                    {addingIn === key ? (
                      <AddTask people={role.people.length ? role.people : people} onCancel={() => setAddingIn(null)}
                        onAdd={async (task, description, assignee) => { await post({ action: "addTask", task, description, assignee, department: dept.department, role: role.role }); setAddingIn(null); }} />
                    ) : (
                      <button onClick={() => setAddingIn(key)} className="w-full py-3.5 text-left text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)]">+ Add task</button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {completed.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 border-b border-[var(--panel-border)] pb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Completed</h2>
          <div>
            <ul>
              {completed.map((t) => (
                <li key={t.id} className="group flex items-center gap-3.5 border-b border-[var(--panel-border)] py-3.5 last:border-0">
                  <button aria-label="Reopen" disabled={busy} onClick={() => post({ action: "toggle", id: t.id, done: false })}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</button>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-muted)] line-through">{t.task}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{relDate(t.completedAt)}</span>
                  <button aria-label="Delete" onClick={() => post({ action: "deleteTask", id: t.id })} className="text-[var(--text-muted)] opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100">✕</button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {composer ? (
        <TaskComposer people={people} departments={departments} roles={roles} onClose={() => setComposer(false)}
          onAdd={async (payload) => { await post({ action: "addTask", ...payload }); setComposer(false); }} />
      ) : null}
      {managePeople ? <PeoplePanel people={people} departments={departments} onClose={() => setManagePeople(false)} post={post} /> : null}
    </div>
  );
}

function AddTask({ people, onAdd, onCancel }: { people: Person[]; onAdd: (task: string, description: string, assignee: string) => Promise<void>; onCancel: () => void }) {
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(people[0]?.name ?? "");
  const input = "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
  return (
    <div className="space-y-2 border-b border-[var(--panel-border)] py-4">
      <input autoFocus value={task} onChange={(e) => setTask(e.target.value)} placeholder="Task name" className={input} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (what exactly it is)" className={input} />
      <div className="flex items-center gap-2">
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-2 text-sm text-[var(--text)]">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <button disabled={!task.trim()} onClick={() => onAdd(task.trim(), description.trim(), assignee)} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        <button onClick={onCancel} className="px-2 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
      </div>
    </div>
  );
}

function EditTask({ task, people, busy, onSave, onCancel }: { task: Task; people: Person[]; busy: boolean; onSave: (f: { task: string; description: string; assignee: string }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(task.task);
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee);
  const input = "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
  return (
    <li className="space-y-2 border-b border-[var(--panel-border)] py-4 last:border-0">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={input} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={input} />
      <div className="flex items-center gap-2">
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-2 text-sm text-[var(--text)]">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <button disabled={busy || !name.trim()} onClick={() => onSave({ task: name.trim(), description: description.trim(), assignee })} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
        <button onClick={onCancel} className="px-2 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
      </div>
    </li>
  );
}

function TaskComposer({ people, departments, roles, onAdd, onClose }: { people: Person[]; departments: string[]; roles: string[]; onAdd: (p: { task: string; description: string; department: string; role: string; assignee: string }) => Promise<void>; onClose: () => void }) {
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [role, setRole] = useState("");
  const [assignee, setAssignee] = useState("");
  const input = "w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[var(--text-strong)]">New task</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">Close</button></div>
        <div className="mt-4 space-y-2.5">
          <input autoFocus value={task} onChange={(e) => setTask(e.target.value)} placeholder="Task name" className={input} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (what exactly it is)" className={input} />
          <div className="flex gap-2">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" list="comp-depts" className={input} />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" list="comp-roles" className={input} />
          </div>
          <datalist id="comp-depts">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          <datalist id="comp-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={input}>
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.name}>{p.name} — {p.role}</option>)}
          </select>
          <button disabled={!task.trim() || !department.trim() || !role.trim()}
            onClick={() => onAdd({ task: task.trim(), description: description.trim(), department: department.trim(), role: role.trim(), assignee })}
            className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add task</button>
        </div>
      </div>
    </div>
  );
}

function PeoplePanel({ people, departments, onClose, post }: { people: Person[]; departments: string[]; onClose: () => void; post: (p: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const input = "rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[var(--text-strong)]">People</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">Close</button></div>
        <ul className="mt-4 divide-y divide-[var(--panel-border)]">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[11px] font-bold text-[var(--accent)]">{initials(p.name)}</span>
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[var(--text-strong)]">{p.name}</div><div className="text-xs text-[var(--text-muted)]">{p.department} · {p.role}</div></div>
              <button onClick={() => post({ action: "removePerson", id: p.id })} className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-rose-500">Remove</button>
            </li>
          ))}
          {people.length === 0 ? <li className="py-3 text-sm text-[var(--text-muted)]">No people yet. Add the first below.</li> : null}
        </ul>
        <div className="mt-5 space-y-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add a person</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={`w-full ${input}`} />
          <div className="flex gap-2">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" list="ppl-depts" className={`w-1/2 ${input}`} />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className={`w-1/2 ${input}`} />
          </div>
          <datalist id="ppl-depts">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          <button disabled={!name.trim() || !department.trim() || !role.trim()}
            onClick={async () => { await post({ action: "addPerson", name: name.trim(), department: department.trim(), role: role.trim() }); setName(""); setRole(""); }}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add person</button>
        </div>
      </div>
    </div>
  );
}
