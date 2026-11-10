import { BerlinHeader, Panel, EmptyState, Tag } from "@/components/berlin/Berlin";

/** Berlin / Funnel — every funnel as a board. Empty-state scaffold with one draft card. */
export default function FunnelsPage() {
  return (
    <div>
      <BerlinHeader
        title="Funnels"
        subtitle="Every funnel as a board: pages, messages, waits and audiences wired together, with the numbers on each step once sources are connected."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Panel className="transition-colors hover:border-[var(--accent)]/40">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text-strong)]">First funnel</div>
            <Tag tone="muted">Draft</Tag>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">1 step &middot; 0 connections</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text)]">
              Analytics
            </button>
            <button className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text)]">
              Build
            </button>
          </div>
        </Panel>
      </div>

      <EmptyState
        title="Build a funnel board"
        body="A funnel is a map of pages, messages, waits and audiences. Analytics fills in once the client's sources are connected."
        hint="Maps are built by your Claude: ask it to save the funnel with the connector."
        action={{ href: "/bronson/integrations", label: "Open Integrations" }}
      />
    </div>
  );
}
