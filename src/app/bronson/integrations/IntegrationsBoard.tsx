"use client";

import { useState } from "react";
import useSWR from "swr";
import { BerlinHeader, Panel, Tag } from "@/components/berlin/Berlin";
import { INTEGRATIONS, type Integration } from "@/lib/berlin/integrations";

type Status = { connected: boolean; note: string; updatedAt: string | null };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

function Tile({ it, connected, busy, onToggle }: { it: Integration; connected: boolean; busy: boolean; onToggle: (next: boolean) => void }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] text-sm font-bold text-[var(--text-strong)]">
          {it.short}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-strong)]">{it.name}</span>
            <Tag tone="muted">{it.category}</Tag>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{it.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            connected ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--panel-subtle)] text-[var(--text-muted)]"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={busy}
          onClick={() => onToggle(!connected)}
          className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-opacity disabled:opacity-50 ${
            connected
              ? "border border-[var(--panel-border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              : "bg-[var(--accent)] text-white hover:opacity-90"
          }`}
        >
          {busy ? "…" : connected ? "Disconnect" : "Connect"}
        </button>
        {it.connectsToDashboard ? <Tag>Feeds dashboard</Tag> : null}
        {it.addToClaude ? <Tag tone="muted">For your Claude</Tag> : null}
      </div>
    </Panel>
  );
}

export function IntegrationsBoard() {
  const { data, mutate } = useSWR<{ statuses: Record<string, Status> }>("/api/bronson/integrations", fetcher, { refreshInterval: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const statuses = data?.statuses ?? {};

  async function toggle(name: string, next: boolean) {
    setBusy(name);
    // optimistic
    mutate({ statuses: { ...statuses, [name]: { connected: next, note: statuses[name]?.note ?? "", updatedAt: null } } }, false);
    try {
      const res = await fetch("/api/bronson/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, connected: next }),
      });
      if (res.ok) mutate(await res.json(), false);
    } finally {
      setBusy(null);
    }
  }

  const dashboard = INTEGRATIONS.filter((i) => i.tier === "dashboard");
  const claude = INTEGRATIONS.filter((i) => i.tier === "claude");
  const connectedCount = INTEGRATIONS.filter((i) => statuses[i.name]?.connected).length;

  const grid = (list: Integration[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((it) => (
        <Tile key={it.name} it={it} connected={!!statuses[it.name]?.connected} busy={busy === it.name} onToggle={(next) => toggle(it.name, next)} />
      ))}
    </div>
  );

  return (
    <div>
      <BerlinHeader
        title="Integrations"
        subtitle="The tools Bronson runs on. Mark a source Connected once it is wired and feeding. The actual keys/automation live in the backend (n8n + API keys); ask me to wire any source and I set it up."
      />

      <div className="mb-8 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-4 text-sm text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-strong)]">{connectedCount} of {INTEGRATIONS.length} connected. </span>
        One CRM is enough (GoHighLevel or Close), and one checkout (Commas or Whop).
      </div>

      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Feeds your dashboard</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Connect these first: they fill the numbers, pace and scorecard.</p>
        {grid(dashboard)}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Optional, for your Claude</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Extra sources the research, audit and automation steps can read or act on.</p>
        {grid(claude)}
      </section>
    </div>
  );
}
