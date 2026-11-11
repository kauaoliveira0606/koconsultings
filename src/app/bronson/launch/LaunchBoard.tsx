"use client";

import { useState } from "react";
import useSWR from "swr";
import { Rocket, Check } from "lucide-react";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";
import type { Flow } from "@/lib/flows";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Types = Record<string, { label: string; steps: string[] }>;
const STATUS_COLOR: Record<string, string> = { "Up Next": "#7c3aed", Doing: "#2563eb", Blocked: "#94a3b8", Review: "#db2777", Done: "#059669" };
const STATUS_LABEL: Record<string, string> = { "Up Next": "Queued for AI", Doing: "Doing", Blocked: "Waiting", Review: "Needs your review", Done: "Done" };

/** Launch: turn an idea into a chain of AI tasks and watch it move from research to live. */
export function LaunchBoard() {
  const { data, mutate } = useSWR<{ flows: Flow[]; types: Types }>("/api/bronson/flows", fetcher, { refreshInterval: 60_000 });
  const flows = Array.isArray(data?.flows) ? data!.flows : [];
  const types = data?.types ?? {};
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [type, setType] = useState("launch");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/bronson/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, idea, type }) });
    const j = await r.json();
    if (r.ok) {
      await mutate({ flows: j.flows, types }, false);
      setName("");
      setIdea("");
    } else setError(j.error ?? "Couldn't start it");
    setBusy(false);
  }

  return (
    <div>
      <BerlinHeader
        title="Launch"
        subtitle="One idea in, a finished flow out. Each step lands in the Office AI queue with the right skill and SOP; you approve each step in Review and the next one starts from it."
      />

      <Panel className="mb-8">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Nov 23 masterclass)" className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm">
              {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {types[type] ? <div className="text-[12px] text-[var(--text-muted)]">Steps: {types[type].steps.join(" → ")}</div> : null}
          </div>
          <div>
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder="Describe the idea: the offer or angle, who it's for, and anything that must be in it." className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm" />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={start} disabled={busy || !name.trim() || !idea.trim()} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                <Rocket size={15} /> {busy ? "Starting…" : "Start flow"}
              </button>
              {error ? <span className="text-sm text-rose-600">{error}</span> : null}
            </div>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {flows.map((f) => (
          <Panel key={f.name}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[16px] font-bold text-[var(--text-strong)]">{f.name}</div>
              <div className="text-[12px] text-[var(--text-muted)]">{f.done} of {f.steps.length} done</div>
            </div>
            <div className="flex flex-wrap items-stretch gap-2">
              {f.steps.map((s, i) => (
                <div key={s.task.id} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-[var(--text-muted)]">→</span> : null}
                  <a href="/bronson/office" className="block min-w-[150px] rounded-lg border border-[var(--panel-border)] p-3 hover:border-[var(--accent)]/50">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: STATUS_COLOR[s.task.status] }}>
                      {s.task.status === "Done" ? <Check size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s.task.status] }} />}
                      {STATUS_LABEL[s.task.status] ?? s.task.status}
                    </div>
                    <div className="mt-1 text-[14px] font-semibold text-[var(--text-strong)]">{s.n}. {s.step}</div>
                  </a>
                </div>
              ))}
            </div>
          </Panel>
        ))}
        {data && !flows.length ? <p className="text-sm text-[var(--text-muted)]">No flows yet. Start one above.</p> : null}
      </div>
    </div>
  );
}
