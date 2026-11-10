"use client";

import { useState } from "react";
import useSWR from "swr";
import { RefreshCw } from "lucide-react";
import { BerlinHeader, Panel, Tag } from "@/components/berlin/Berlin";
import { INTEGRATIONS, type Integration } from "@/lib/berlin/integrations";

type CheckResult = { name: string; state: "connected" | "problem" | "unverified"; detail: string; checkedAt: string };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

const STATE: Record<CheckResult["state"], { label: string; style: React.CSSProperties }> = {
  connected: { label: "Connected", style: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" } },
  problem: { label: "Problem", style: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" } },
  unverified: { label: "Not verified", style: { background: "var(--panel-subtle)", color: "var(--text-muted)" } },
};

function Tile({ it, result }: { it: Integration; result?: CheckResult }) {
  const st = result ? STATE[result.state] : null;
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">{it.short}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[var(--text-strong)]">{it.name}</span>
            {st ? (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={st.style}>{st.label}</span>
            ) : (
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">Checking…</span>
            )}
          </div>
          <div className="text-[12px] text-[var(--text-muted)]">{it.category}</div>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[var(--text-muted)]">{it.description}</p>
      {result ? (
        <p className="mt-3 rounded-md bg-[var(--panel-subtle)] px-2.5 py-2 text-[12px] leading-snug text-[var(--text-strong)]">{result.detail}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {it.connectsToDashboard ? <Tag>Feeds dashboard</Tag> : null}
        {it.addToClaude ? <Tag tone="muted">For your Claude</Tag> : null}
      </div>
    </Panel>
  );
}

/** Integrations: every source is checked for real (key test or data freshness). Nothing is marked connected by hand. */
export function IntegrationsBoard() {
  const { data, mutate, isValidating } = useSWR<{ results: CheckResult[] }>("/api/bronson/integrations", fetcher);
  const [rechecking, setRechecking] = useState(false);
  const results = new Map((Array.isArray(data?.results) ? data!.results : []).map((r) => [r.name, r]));

  async function recheck() {
    setRechecking(true);
    try {
      const res = await fetch("/api/bronson/integrations?fresh=1");
      if (res.ok) await mutate(await res.json(), false);
    } finally {
      setRechecking(false);
    }
  }

  const count = (s: CheckResult["state"]) => INTEGRATIONS.filter((i) => results.get(i.name)?.state === s).length;
  const checkedAt = data?.results?.[0]?.checkedAt;
  const grid = (list: Integration[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((it) => <Tile key={it.name} it={it} result={results.get(it.name)} />)}
    </div>
  );

  return (
    <div>
      <BerlinHeader
        title="Integrations"
        subtitle="Every source is checked for real: the dashboard calls the service with its own key, or checks how recently its data last synced. Nothing is marked connected by hand."
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-4 text-sm text-[var(--text-muted)]">
        <span>
          <span className="font-semibold text-[var(--text-strong)]">{count("connected")} connected</span> · {count("problem")} with a problem · {count("unverified")} not verified
          {checkedAt ? ` · checked ${new Date(checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : ""}
        </span>
        <button
          onClick={recheck}
          disabled={rechecking || isValidating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={rechecking ? "animate-spin" : ""} /> {rechecking ? "Checking…" : "Check again"}
        </button>
      </div>

      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Feeds your dashboard</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">These fill the numbers, pace and scorecard.</p>
        {grid(INTEGRATIONS.filter((i) => i.tier === "dashboard"))}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Optional, for your Claude</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Extra sources the research, audit and automation steps can read or act on.</p>
        {grid(INTEGRATIONS.filter((i) => i.tier === "claude"))}
      </section>
    </div>
  );
}
