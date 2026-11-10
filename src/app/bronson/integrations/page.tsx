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
      <div className="mt-3 flex flex-wrap gap-1.5">
        {it.connectsToDashboard ? <Tag>Feeds dashboard</Tag> : null}
        {it.addToClaude ? <Tag tone="muted">For your Claude</Tag> : null}
      </div>
    </Panel>
  );
}

export default function IntegrationsPage() {
  const dashboard = INTEGRATIONS.filter((i) => i.tier === "dashboard");
  const claude = INTEGRATIONS.filter((i) => i.tier === "claude");

  return (
    <div>
      <BerlinHeader
        title="Integrations"
        subtitle="The tools Bronson runs on. This is a reference map of the stack, connections are wired in the backend (n8n + API keys), not from this page."
      />

      <div className="mb-8 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-4 text-sm text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-strong)]">How connections work: </span>
        sources are connected by your operator through n8n workflows and stored API keys, so these cards show what each tool feeds, not a click-to-connect button. Tell me to wire a new source and I set it up in the backend.
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
