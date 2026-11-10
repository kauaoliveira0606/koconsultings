"use client";

import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { StatCard } from "@/components/dashboard/StatCard";
import { Panel, EmptyState } from "@/components/berlin/Berlin";
import { formatStatValue } from "@/lib/format";

type SourceRow = {
  source: string;
  class: "Paid" | "Organic";
  spend: number;
  revenue: number;
  leads: number;
  purchases: number;
  roas: number | null;
};

type AdsData = {
  totals: {
    adSpend: number;
    paidRevenue: number;
    organicRevenue: number;
    totalRevenue: number;
    paidRoas: number | null;
    costPerLeadPaid: number | null;
    leads: number;
    paidLeads: number;
  };
  sources: SourceRow[];
  daily: { date: string; spend: number; revenue: number }[];
  hasData: boolean;
};

export function AdsBoard() {
  const { range, setRange } = useSharedRange();
  const { data, isLoading } = useSectionData<AdsData>("/api/bronson/ads", range, 300_000);

  const t = data?.totals;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Ads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Spend vs the revenue it brought in, by source. From Cortana attribution.</p>
        </div>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ad spend" value={t?.adSpend ?? null} format="currency" subtext="Paid traffic spend in range (Cortana)." />
        <StatCard label="Revenue (paid)" value={t?.paidRevenue ?? null} format="currency" subtext="Revenue attributed to paid sources." />
        <StatCard
          label="Paid ROAS"
          value={t?.paidRoas ?? null}
          format="ratio"
          subtext="Paid revenue ÷ ad spend."
          status={t?.paidRoas == null ? null : t.paidRoas >= 1 ? "green" : t.paidRoas >= 0.7 ? "yellow" : "red"}
        />
        <StatCard label="Cost per lead (paid)" value={t?.costPerLeadPaid ?? null} format="currency" subtext="Ad spend ÷ paid leads." />
      </div>

      {!isLoading && data && !data.hasData ? (
        <EmptyState
          title="No ad numbers in this range"
          body="Cortana has no attributed spend or revenue for the selected dates. Widen the range, or wait for the next daily sync."
          hint="Collected daily from Cortana's per-source attribution."
        />
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--panel-border)] px-6 py-4 text-[15px] font-semibold text-[var(--text-strong)]">
            By source
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">Class</th>
                  <th className="px-6 py-3 text-right font-medium">Spend</th>
                  <th className="px-6 py-3 text-right font-medium">Revenue</th>
                  <th className="px-6 py-3 text-right font-medium">Leads</th>
                  <th className="px-6 py-3 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {(data?.sources ?? []).map((s) => (
                  <tr key={s.source} className="border-t border-[var(--panel-border)]">
                    <td className="px-6 py-3.5 font-medium text-[var(--text-strong)]">{s.source}</td>
                    <td className="px-6 py-3.5 text-[var(--text-muted)]">{s.class}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{s.spend ? formatStatValue(s.spend, "currency") : "–"}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{formatStatValue(s.revenue, "currency")}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{s.leads}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{s.roas == null ? "–" : formatStatValue(s.roas, "ratio")}</td>
                  </tr>
                ))}
                {!data && isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">Loading…</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Bronson&rsquo;s Cortana attribution, collected daily into Airtable (Vercel cannot call Cortana directly).
      </p>
    </div>
  );
}
