import { BerlinHeader, Panel } from "@/components/berlin/Berlin";

/** Berlin / Connect Claude — set up the MCP connector so Claude works the dashboard. */
export default function ConnectPage() {
  return (
    <div className="max-w-4xl">
      <BerlinHeader
        title="Connect Claude"
        subtitle="Berlin for Claude puts the dashboard inside your own Claude. Ask for what you need, like the ads or the VSL for a client, and Claude does the job with Berlin behind it."
      />

      <Panel className="mb-5">
        <div className="text-sm font-semibold text-[var(--text-strong)]">Your connector link</div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Live. Add this as a custom connector, then turn Berlin on in a chat.</p>
        <code className="mt-3 block overflow-x-auto rounded-md bg-[var(--panel-subtle)] px-3 py-2 text-xs text-[var(--text-strong)]">
          https://www.koconsultings.com/api/berlin/mcp?token=YOUR_TOKEN
        </code>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Replace YOUR_TOKEN with your BERLIN_MCP_TOKEN (kept in your credentials, not shown here). Tools available now:
          get_ads_by_source, get_overview_metrics, get_live_cash_today, get_revenue_by_source_pnl.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel>
          <div className="mb-2 text-sm font-semibold text-[var(--text-strong)]">claude.ai or the Claude desktop app</div>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-[var(--text-muted)]">
            <li>Open Settings then Connectors (same account).</li>
            <li>Click Add custom connector.</li>
            <li>Name it Berlin, paste your link.</li>
            <li>In a chat, open the tools menu and turn Berlin on.</li>
          </ol>
        </Panel>
        <Panel>
          <div className="mb-2 text-sm font-semibold text-[var(--text-strong)]">Claude Code (optional)</div>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-[var(--text-muted)]">
            <li>Paste the Claude Code line in the Terminal app, not a chat.</li>
            <li>Run <code className="rounded bg-[var(--panel-subtle)] px-1">claude mcp list</code>: Berlin should show as connected.</li>
            <li>Then say: &ldquo;Use Berlin. List the processes.&rdquo;</li>
          </ol>
        </Panel>
      </div>

      <p className="mt-5 text-xs text-[var(--text-muted)]">
        The connector server is the next build: an MCP endpoint that reads this dashboard and runs the delivery process on the connected accounts.
      </p>
    </div>
  );
}
