"use client";

import { useState } from "react";
import { HeroStat } from "@/components/dashboard/HeroStat";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { formatStatValue } from "@/lib/format";
import type { SalesCycleResponse, SalesCycleRow } from "@/lib/sales-cycle";
import { useSectionData } from "@/lib/use-section-data";

const PANEL =
  "min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm";

/** Days shown on the cards: one decimal, never "days" for exactly one. */
const daysLabel = (n: number | null | undefined) =>
  n === null || n === undefined ? undefined : `${formatStatValue(n, "number")} ${n === 1 ? "day" : "days"}`;

const shortDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

/** How long closes took, in the buckets the table can be read against. */
const BUCKETS: { label: string; max: number }[] = [
  { label: "Same day", max: 0 },
  { label: "1-7 days", max: 7 },
  { label: "8-14 days", max: 14 },
  { label: "15-30 days", max: 30 },
  { label: "31-60 days", max: 60 },
  { label: "60+ days", max: Infinity },
];

function Distribution({ rows }: { rows: SalesCycleRow[] }) {
  const counts = BUCKETS.map(() => 0);
  for (const r of rows) {
    if (r.days === null) continue;
    counts[BUCKETS.findIndex((b) => r.days! <= b.max)] += 1;
  }
  const top = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2.5">
      {BUCKETS.map((b, i) => (
        <div key={b.label} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm">
          <span className="text-[var(--text-muted)]">{b.label}</span>
          <div className="h-2.5 rounded-full bg-white/[0.06]">
            <div className="h-2.5 rounded-full bg-sky-400" style={{ width: `${(counts[i] / top) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums text-white">
            {counts[i]}
            <span className="ml-1 text-xs text-[var(--text-muted)]">{total ? `${Math.round((counts[i] / total) * 100)}%` : ""}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Sales cycle: days from a lead's first opt-in to their first close, one row
 * per closed lead (per kind), with the average and median over the range.
 */
export function SalesCycleSection({ apiPath, range, period }: { apiPath: string; range: RangeState; period: string | null }) {
  const { data } = useSectionData<SalesCycleResponse>(apiPath, range);
  const [filter, setFilter] = useState<"All" | SalesCycleRow["kind"]>("All");
  const rows = data?.rows ?? [];
  const shown = filter === "All" ? rows : rows.filter((r) => r.kind === filter);
  const unmatched = data ? data.closes - data.matched : 0;
  const filters = data?.hasAffiliate
    ? (["All", "High Ticket", "Affiliate"] as const).map((k) => ({
        key: k,
        n: k === "All" ? rows.length : rows.filter((r) => r.kind === k).length,
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${data?.hasAffiliate ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <HeroStat
          size="md"
          label="Avg Sales Cycle"
          value={data?.avgDays}
          format="number"
          override={daysLabel(data?.avgDays)}
          period={period}
          sub="First opt-in to first close"
        />
        <HeroStat
          size="md"
          label="Median Sales Cycle"
          value={data?.medianDays}
          format="number"
          override={daysLabel(data?.medianDays)}
          period={period}
          sub="Half of closes are faster than this"
        />
        <HeroStat
          size="md"
          label="Avg Cycle (High Ticket)"
          value={data?.avgDaysHighTicket}
          format="number"
          override={daysLabel(data?.avgDaysHighTicket)}
          period={period}
          sub="To the first high ticket close"
        />
        {data?.hasAffiliate ? (
          <HeroStat
            size="md"
            label="Avg Cycle (Affiliate)"
            value={data.avgDaysAffiliate}
            format="number"
            override={daysLabel(data.avgDaysAffiliate)}
            period={period}
            sub="To the first affiliate sale"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={PANEL}>
          <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">How Long Closes Took</div>
          {data ? <Distribution rows={shown} /> : <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
          {data && !data.ghlConnected ? (
            <p className="mt-4 text-xs text-amber-300">GHL isn&apos;t connected here yet, so opt-in dates come from the Leads table only.</p>
          ) : null}
          {data && unmatched > 0 ? (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {unmatched} of {data.closes} closes have no opt-in found before the close (no email, or not in GHL or the Leads table) and are left out of the averages.
            </p>
          ) : null}
        </div>

        <div className={`${PANEL} lg:col-span-2`}>
          {filters.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {filters.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setFilter(o.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    filter === o.key
                      ? "border-sky-400 bg-sky-400/15 text-white"
                      : "border-[var(--panel-border)] text-[var(--text-muted)] hover:text-white"
                  }`}
                >
                  {o.key} · {o.n}
                </button>
              ))}
            </div>
          ) : null}
          {!data ? (
            <p className="text-sm text-[var(--text-muted)]">Loading...</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No closes in this range.</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
                <thead className="sticky top-0 bg-[var(--panel-bg)]">
                  <tr className="text-[13px] text-[var(--text-muted)]">
                    {["Lead", "Kind", "First Opt-In", "Closed", "Outcome", "Cash", "Sales Cycle"].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 font-semibold ${i >= 5 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-[var(--text-strong)]">{r.name ?? r.email ?? "—"}</span>
                        {r.name && r.email ? <span className="block text-xs text-[var(--text-muted)]">{r.email}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-white">{r.kind}</td>
                      <td className="px-3 py-2.5 text-white">
                        {shortDate(r.optInDate)}
                        {r.optInFrom ? <span className="block text-xs text-[var(--text-muted)]">{r.optInFrom}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-white">{shortDate(r.closeDate)}</td>
                      <td className="px-3 py-2.5 text-white">
                        {r.outcome ?? "—"}
                        {r.offer ? <span className="block text-xs text-[var(--text-muted)]">{r.offer}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white">
                        {r.cashCollected ? formatStatValue(r.cashCollected, "currency") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-white">
                        {r.days !== null ? daysLabel(r.days) : <span className="font-normal text-[var(--text-muted)]">No opt-in found</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data?.hasAffiliate ? <AscensionCycle data={data} period={period} /> : null}
    </div>
  );
}

/** Affiliate buyers who moved up to high ticket: days from the first affiliate sale to the first high ticket close. */
function AscensionCycle({ data, period }: { data: SalesCycleResponse; period: string | null }) {
  const rows = data.ascensions;
  return (
    <div className="space-y-4 pt-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Affiliate → High Ticket</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HeroStat
          size="md"
          label="Avg Affiliate → HT"
          value={data.avgDaysAscension}
          format="number"
          override={daysLabel(data.avgDaysAscension)}
          period={period}
          sub="First affiliate sale to first high ticket close"
        />
        <HeroStat
          size="md"
          label="Median Affiliate → HT"
          value={data.medianDaysAscension}
          format="number"
          override={daysLabel(data.medianDaysAscension)}
          period={period}
          sub="Half moved up faster than this"
        />
        <HeroStat
          size="md"
          label="Moved Up"
          value={rows.length}
          format="number"
          period={period}
          sub="High ticket closes who bought affiliate first"
        />
      </div>
      <div className={PANEL}>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No affiliate buyers closed high ticket in this range.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
              <thead className="sticky top-0 bg-[var(--panel-bg)]">
                <tr className="text-[13px] text-[var(--text-muted)]">
                  {["Lead", "Affiliate Sale", "High Ticket Close", "Outcome", "Cash", "Cycle"].map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 font-semibold ${i >= 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-[var(--text-strong)]">{r.name ?? r.email}</span>
                      {r.name ? <span className="block text-xs text-[var(--text-muted)]">{r.email}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-white">{shortDate(r.affiliateDate)}</td>
                    <td className="px-3 py-2.5 text-white">{shortDate(r.highTicketDate)}</td>
                    <td className="px-3 py-2.5 text-white">
                      {r.highTicketOutcome ?? "—"}
                      {r.highTicketOffer ? <span className="block text-xs text-[var(--text-muted)]">{r.highTicketOffer}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">
                      {r.highTicketCash ? formatStatValue(r.highTicketCash, "currency") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-white">{daysLabel(r.days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
