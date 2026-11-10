"use client";

import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { StatCard } from "@/components/dashboard/StatCard";
import { Panel, EmptyState } from "@/components/berlin/Berlin";
import { PacePanel } from "@/components/berlin/PacePanel";
import { AdsEntityTable } from "@/components/berlin/AdsEntityTable";
import { KpiValue, toneFor } from "@/components/berlin/kpi";
import { formatStatValue } from "@/lib/format";
import type { AdsEntity } from "@/lib/ads-cortana";

type SourceRow = {
  source: string;
  class: "Paid" | "Organic";
  revenue: number;
  leads: number;
  purchases: number;
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
  campaigns: AdsEntity[];
  ads: AdsEntity[];
  cortanaSpend: number;
  lastSpendDate: string | null;
  hasData: boolean;
};

function datesOf(rows: AdsEntity[]): string[] {
  return [...new Set(rows.flatMap((r) => r.daily.map((d) => d.date)))].sort();
}

export function AdsBoard() {
  const { range, setRange } = useSharedRange();
  const { data, isLoading } = useSectionData<AdsData>("/api/bronson/ads", range, 300_000);

  const t = data?.totals;
  const top = data?.campaigns.find((c) => c.spend > 0) ?? null;
  const topAd = data?.ads.find((c) => c.spend > 0) ?? null;
  const dates = datesOf([...(data?.campaigns ?? []), ...(data?.ads ?? [])]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Ads</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Live pace, then every campaign and ad with what it spent and what it brought back.</p>
      </div>

      <PacePanel />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[15px] font-semibold text-[var(--text-strong)]">Breakdown</div>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ad spend" value={t?.adSpend ?? null} format="currency" subtext="Meta spend, from the daily form." />
        <StatCard label="Revenue (paid)" value={t?.paidRevenue ?? null} format="currency" subtext="Revenue attributed to paid sources (Cortana)." />
        <StatCard
          label="Paid ROAS"
          value={t?.paidRoas ?? null}
          format="ratio"
          subtext="Paid revenue ÷ ad spend."
          status={toneFor("roas", t?.paidRoas)}
        />
        <StatCard label="Cost per lead (paid)" value={t?.costPerLeadPaid ?? null} format="currency" subtext="Ad spend ÷ paid leads." />
      </div>

      {top ? (
        <Panel className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Spending the most</div>
          <div className="mt-1 text-lg font-bold text-[var(--text-strong)]">{top.name}</div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Mini label="Spend" value={<KpiValue value={top.spend} format="currency" bold />} sub={top.spendShare != null ? `${(top.spendShare * 100).toFixed(0)}% of all spend` : undefined} />
            <Mini label="Opt-ins" value={<KpiValue value={top.registrations} format="number" bold />} />
            <Mini label="Cost / opt-in" value={<KpiValue value={top.costPerOptIn} format="currency" tone={toneFor("costPerOptIn", top.costPerOptIn)} bold />} />
            <Mini label="Booked calls" value={<KpiValue value={top.booked} format="number" bold />} sub={top.costPerBooked != null ? `${formatStatValue(top.costPerBooked, "currency")} each` : undefined} />
            <Mini label="Revenue" value={<KpiValue value={top.revenue} format="currency" bold />} sub={`${top.sales} sale${top.sales === 1 ? "" : "s"}`} />
            <Mini label="ROAS" value={<KpiValue value={top.roas} format="ratio" tone={toneFor("roas", top.roas)} bold />} />
          </div>
          {topAd ? (
            <p className="mt-4 text-[13px] text-[var(--text-muted)]">
              Top ad: <span className="font-semibold text-[var(--text-strong)]">{topAd.name}</span> · {formatStatValue(topAd.spend, "currency")} spend ·{" "}
              {topAd.registrations} opt-ins at {formatStatValue(topAd.costPerOptIn, "currency")} · {formatStatValue(topAd.revenue, "currency")} revenue
            </p>
          ) : null}
        </Panel>
      ) : null}

      {!isLoading && data && !data.hasData ? (
        <EmptyState
          title="No ad numbers in this range"
          body="No ad spend or attributed revenue for the selected dates. Widen the range, or wait for the next sync."
        />
      ) : (
        <>
          <AdsEntityTable
            title="Campaigns"
            subtitle="Sorted by spend. Click a column to sort. Colors use your KPI lines."
            rows={data?.campaigns ?? []}
            dates={dates}
          />
          <AdsEntityTable title="Ads" subtitle="Every ad, same columns." rows={data?.ads ?? []} dates={dates} />

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-[var(--panel-border)] px-6 py-4 text-[15px] font-semibold text-[var(--text-strong)]">
              Revenue by source
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-6 py-3 font-medium">Source</th>
                    <th className="px-6 py-3 font-medium">Class</th>
                    <th className="px-6 py-3 text-right font-medium">Revenue</th>
                    <th className="px-6 py-3 text-right font-medium">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.sources ?? []).map((s) => (
                    <tr key={s.source} className="border-t border-[var(--panel-border)]">
                      <td className="px-6 py-3.5 font-medium text-[var(--text-strong)]">{s.source}</td>
                      <td className="px-6 py-3.5 text-[var(--text-muted)]">{s.class}</td>
                      <td className="px-6 py-3.5 text-right tabular-nums">{formatStatValue(s.revenue, "currency")}</td>
                      <td className="px-6 py-3.5 text-right tabular-nums">{s.leads}</td>
                    </tr>
                  ))}
                  {!data && isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-[var(--text-muted)]">Loading…</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
        Top cards: ad spend from the Marketing Daily Metrics form (source of truth for total spend). Campaign and ad rows: Cortana, synced hourly
        {data?.lastSpendDate ? `; spend posted through ${data.lastSpendDate}` : ""}. Cortana&rsquo;s campaign spend can differ from the form total
        {data ? ` (${formatStatValue(data.cortanaSpend, "currency")} in this range)` : ""}.
      </p>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-[1.15rem]">{value}</div>
      {sub ? <div className="text-[11px] text-[var(--text-muted)]">{sub}</div> : null}
    </div>
  );
}
