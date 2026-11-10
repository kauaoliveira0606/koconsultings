import { BerlinHeader, Panel, Tag } from "@/components/berlin/Berlin";
import { INTEGRATIONS, type Integration } from "@/lib/berlin/integrations";

function Tile({ it }: { it: Integration }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] text-sm font-bold text-[var(--text-strong)]">
          {it.short}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-strong)]">{it.name}</span>
            <Tag tone="muted">{it.category}</Tag>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{it.description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {it.connectsToDashboard ? (
          <button className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)]">
            Connect to dashboard
          </button>
        ) : null}
        {it.addToClaude ? (
          <button className="rounded-md border border-[var(--panel-border)] bg-transparent px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
            Add to your Claude
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

export default function IntegrationsPage() {
  const dashboard = INTEGRATIONS.filter((i) => i.tier === "dashboard");
  const claude = INTEGRATIONS.filter((i) => i.tier === "claude");
  const connected = 0;

  return (
    <div>
      <BerlinHeader
        title="Integrations"
        subtitle="Connect the tools Bronson runs on. Dashboard sources fill the numbers, pace and scorecard; Claude sources let the process work on the accounts."
      />

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-4 text-sm">
        <span className="font-semibold text-[var(--text-strong)]">
          {connected} of {INTEGRATIONS.length} sources connected
        </span>
        <span className="text-[var(--text-muted)]">
          One CRM is enough (GoHighLevel or Close), and one checkout (Commas or Whop).
        </span>
      </div>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Feeds your dashboard</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Connect these first: they fill the numbers, pace and scorecard.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.map((it) => (
            <Tile key={it.name} it={it} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Optional, for your Claude</h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Extra sources the research, audit and automation steps can read or act on.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {claude.map((it) => (
            <Tile key={it.name} it={it} />
          ))}
        </div>
      </section>
    </div>
  );
}
