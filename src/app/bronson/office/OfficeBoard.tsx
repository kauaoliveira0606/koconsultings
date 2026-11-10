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
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  if (same) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function OfficeBoard() {
  const { data, mutate, isLoading } = useSWR<OfficeData>("/api/bronson/office", fetcher, { refreshInterval: 60_000 });
  const [managePeople, setManagePeople] = useState(false);
  const [addingIn, setAddingIn] = useState<string | null>(null); // "dept|role"
  const [busy, setBusy] = useState(false);

  const people = data?.people ?? [];
  const tasks = data?.tasks ?? [];

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

  // Build department -> role structure from people, filled with open tasks.
  const structure = useMemo(() => {
    const depts = new Map<string, Map<string, { people: Person[]; tasks: Task[] }>>();
    const ensure = (dept: string, role: string) => {
      if (!depts.has(dept)) depts.set(dept, new Map());
      const roles = depts.get(dept)!;
      if (!roles.has(role)) roles.set(role, { people: [], tasks: [] });
      return roles.get(role)!;
    };
    for (const p of people) if (p.active) ensure(p.department, p.role).people.push(p);
    for (const t of tasks) if (!t.done) ensure(t.department, t.role).tasks.push(t);
    return [...depts.entries()].map(([department, roles]) => ({
      department,
      roles: [...roles.entries()].map(([role, g]) => ({ role, ...g })),
    }));
  }, [people, tasks]);

  const completed = tasks.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <BerlinHeader title="Office" subtitle={`${openCount} open · ${completed.length} done · grouped by department and role.`} />
        <button
          onClick={() => setManagePeople(true)}
          className="shrink-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--text-strong)] hover:bg-[var(--panel-subtle)]"
        >
          Manage people
        </button>
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      <div className="space-y-8">
        {structure.map((dept) => (
          <section key={dept.department}>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{dept.department}</h2>
            <div className="space-y-5">
              {dept.roles.map((role) => {
                const key = `${dept.department}|${role.role}`;
                return (
                  <Panel key={key} className="p-0">
                    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--panel-border)] px-5 py-3">
                      <span className="text-[15px] font-semibold text-[var(--text-strong)]">{role.role}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {role.people.map((p) => (
                          <span key={p.id} className="rounded-full bg-[var(--panel-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <ul>
                      {role.tasks.map((t) => (
                        <li key={t.id} className="group flex items-start gap-3 border-b border-[var(--panel-border)] px-5 py-3 last:border-0">
                          <button
                            aria-label="Complete task"
                            disabled={busy}
                            onClick={() => post({ action: "toggle", id: t.id, done: true })}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-[var(--panel-border)] transition-colors hover:border-[var(--accent)]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-medium text-[var(--text-strong)]">{t.task}</div>
                            {t.description ? <div className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{t.description}</div> : null}
                          </div>
                          {t.assignee ? (
                            <span
                              title={t.assignee}
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[10px] font-bold text-[var(--accent)]"
                            >
                              {initials(t.assignee)}
                            </span>
                          ) : null}
                          <button
                            aria-label="Delete task"
                            onClick={() => post({ action: "deleteTask", id: t.id })}
                            className="mt-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--text-strong)] group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>

                    {addingIn === key ? (
                      <AddTask
                        people={role.people}
                        onCancel={() => setAddingIn(null)}
                        onAdd={async (task, description, assignee) => {
                          await post({ action: "addTask", task, description, assignee, department: dept.department, role: role.role });
                          setAddingIn(null);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingIn(key)}
                        className="w-full px-5 py-2.5 text-left text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)]"
                      >
                        + Add task
                      </button>
                    )}
                  </Panel>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {completed.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Completed</h2>
          <Panel className="p-0">
            <ul>
              {completed.map((t) => (
                <li key={t.id} className="group flex items-center gap-3 border-b border-[var(--panel-border)] px-5 py-2.5 last:border-0">
                  <button
                    aria-label="Reopen task"
                    disabled={busy}
                    onClick={() => post({ action: "toggle", id: t.id, done: false })}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white"
                  >
                    ✓
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-muted)] line-through">{t.task}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{relDate(t.completedAt)}</span>
                  <button
                    aria-label="Delete task"
                    onClick={() => post({ action: "deleteTask", id: t.id })}
                    className="text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--text-strong)] group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {managePeople ? <PeoplePanel people={people} onClose={() => setManagePeople(false)} post={post} /> : null}
    </div>
  );
}

function AddTask({
  people,
  onAdd,
  onCancel,
}: {
  people: Person[];
  onAdd: (task: string, description: string, assignee: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(people[0]?.name ?? "");
  return (
    <div className="space-y-2 border-t border-[var(--panel-border)] px-5 py-3">
      <input
        autoFocus
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Task name"
        className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (what exactly it is)"
        className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center gap-2">
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-2 text-sm text-[var(--text)]"
        >
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button
          disabled={!task.trim()}
          onClick={() => onAdd(task.trim(), description.trim(), assignee)}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
        <button onClick={onCancel} className="px-2 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
      </div>
    </div>
  );
}

function PeoplePanel({
  people,
  onClose,
  post,
}: {
  people: Person[];
  onClose: () => void;
  post: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const depts = [...new Set(people.map((p) => p.department))];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">People</h2>
          <button onClick={onClose} className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">Close</button>
        </div>

        <ul className="mt-4 divide-y divide-[var(--panel-border)]">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[11px] font-bold text-[var(--accent)]">{initials(p.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{p.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{p.department} · {p.role}</div>
              </div>
              <button onClick={() => post({ action: "removePerson", id: p.id })} className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-rose-500">Remove</button>
            </li>
          ))}
          {people.length === 0 ? <li className="py-3 text-sm text-[var(--text-muted)]">No people yet. Add the first below.</li> : null}
        </ul>

        <div className="mt-5 space-y-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add a person</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" list="dept-names"
            className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]" />
          <div className="flex gap-2">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" list="depts"
              className="w-1/2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role"
              className="w-1/2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
          </div>
          <datalist id="depts">{depts.map((d) => <option key={d} value={d} />)}</datalist>
          <button
            disabled={!name.trim() || !department.trim() || !role.trim()}
            onClick={async () => { await post({ action: "addPerson", name: name.trim(), department: department.trim(), role: role.trim() }); setName(""); setRole(""); }}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add person
          </button>
        </div>
      </div>
    </div>
  );
}
