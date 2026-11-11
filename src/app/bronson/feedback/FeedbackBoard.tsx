"use client";

import { useState } from "react";
import useSWR from "swr";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";
import { Markdown } from "@/components/berlin/Markdown";
import type { Feedback } from "@/lib/jeremy-feedback";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Jeremy AI's daily feedback (8:30 AM ET) and weekly process review (Mondays), newest first. */
export function FeedbackBoard() {
  const { data, mutate } = useSWR<{ feedback: Feedback[] }>("/api/bronson/feedback", fetcher);
  const { data: status } = useSWR<{ connected: boolean }>("/api/bronson/jeremy", fetcher);
  const list = Array.isArray(data?.feedback) ? data!.feedback : [];
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(type: "daily" | "weekly") {
    setBusy(type);
    setError("");
    const r = await fetch("/api/bronson/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
    const j = await r.json();
    if (r.ok) await mutate(j, false);
    else setError(j.error ?? "Failed");
    setBusy(null);
  }

  const shownId = open ?? list[0]?.id ?? null;
  const shown = list.find((f) => f.id === shownId);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <BerlinHeader
          title="Feedback"
          subtitle="Jeremy AI reads Berlin and writes daily feedback every morning at 8:30 AM ET, plus a full process review every Monday. Each one also lands in the Office for review."
        />
        <div className="flex gap-2">
          <button onClick={() => run("daily")} disabled={!!busy || !status?.connected} className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy === "daily" ? "Jeremy is reviewing… (1-3 min)" : "Daily feedback now"}
          </button>
          <button onClick={() => run("weekly")} disabled={!!busy || !status?.connected} className="rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-semibold disabled:opacity-40">
            {busy === "weekly" ? "Reviewing the process…" : "Process review now"}
          </button>
        </div>
      </div>
      {status && !status.connected ? (
        <p className="mb-4 rounded-md bg-[var(--cell-yellow-bg)] px-3 py-2 text-sm text-[var(--cell-yellow-text)]">Jeremy AI isn&rsquo;t connected yet. Feedback starts as soon as its MCP token is added.</p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {list.map((f) => (
            <button key={f.id} onClick={() => setOpen(f.id)} className={`block w-full rounded-lg border px-3 py-2 text-left ${shownId === f.id ? "border-[var(--accent)] bg-[var(--panel-subtle)]" : "border-[var(--panel-border)]"}`}>
              <div className="text-[11px] font-bold uppercase text-[var(--text-muted)]">{f.type === "weekly" ? "Weekly review" : "Daily"}</div>
              <div className="text-[13px] font-semibold text-[var(--text-strong)]">{f.date}</div>
            </button>
          ))}
          {data && !list.length ? <p className="text-sm text-[var(--text-muted)]">No feedback yet.</p> : null}
        </div>
        <Panel>{shown ? <Markdown source={shown.feedback} /> : <p className="text-sm text-[var(--text-muted)]">Feedback shows here.</p>}</Panel>
      </div>
    </div>
  );
}
