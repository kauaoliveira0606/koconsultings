"use client";

import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import type { CloserLeaderboardResponse, CloserStats } from "@/lib/closer-leaderboard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { useSectionData } from "@/lib/use-section-data";

type Row = {
  label: string;
  key: keyof Omit<CloserStats, "closer">;
  format: StatFormat;
  /** Which way is better, so the best closer on the row can be marked. Omitted = not ranked. */
  best?: "high" | "low";
  note?: string;
};

// Same order and grouping as the team's own closer sheet.
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Funnel",
    rows: [
      { label: "Leads", key: "leads", format: "number", note: "Calls booked + cancelled" },
      { label: "Calls", key: "calls", format: "number", note: "Calls booked" },
      { label: "Show", key: "show", format: "number" },
      { label: "Qualified", key: "qualified", format: "number", note: "Showed, not disqualified" },
      { label: "Won", key: "won", format: "number", best: "high" },
    ],
  },
  {
    title: "Rates",
    rows: [
      { label: "DQ Rate", key: "dqRate", format: "percent", best: "low", note: "Disqualified ÷ Show" },
      { label: "Show %", key: "showRate", format: "percent", best: "high", note: "Show ÷ Calls" },
      { label: "Qualified Show %", key: "qualifiedShowRate", format: "percent", best: "high", note: "Qualified ÷ Calls" },
      { label: "Show To Close %", key: "showToClose", format: "percent", best: "high", note: "Won ÷ Show" },
      { label: "Leads To Close", key: "leadsToClose", format: "percent", best: "high", note: "Won ÷ Leads" },
    ],
  },
  {
    title: "Revenue",
    rows: [
      { label: "Revenue", key: "revenue", format: "currency", best: "high", note: "Cash collected" },
      { label: "Revenue Per Call", key: "revenuePerCall", format: "currency", best: "high" },
      { label: "Rev Per Lead", key: "revPerLead", format: "currency", best: "high" },
      { label: "Last Month Rev Per Lead", key: "lastMonthRevPerLead", format: "currency", best: "high" },
    ],
  },
  {
    title: "Pay",
    rows: [
      { label: "Commission MTD", key: "commissionMtd", format: "currency", best: "high", note: "This month, from the Commissions tab" },
      { label: "Effective Hourly Rate", key: "effectiveHourlyRate", format: "currency", best: "high", note: "Commission this month ÷ calls showed this month" },
      { label: "Effective Hourly Rate (Company)", key: "companyHourlyRate", format: "currency", best: "high", note: "Cash collected ÷ calls showed" },
    ],
  },
];

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Leaderboard for the high ticket closers: one column per closer, ranked by
 * cash collected in the selected range, with the same rows as the team's
 * closer sheet. The best figure on each row is marked.
 */
export function CloserLeaderboard({ apiPath, range }: { apiPath: string; range: RangeState }) {
  const { data } = useSectionData<CloserLeaderboardResponse>(apiPath, range);

  if (!data) {
    return <p className="text-sm text-[var(--text-muted)]">Loading...</p>;
  }
  if (data.closers.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
        No closer EOD reports in this range.
      </div>
    );
  }

  const bestOf = (row: Row): number | null => {
    if (!row.best || data.closers.length < 2) return null;
    const values = data.closers
      .map((c) => c[row.key])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) return null;
    return row.best === "high" ? Math.max(...values) : Math.min(...values);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3 text-left">Closer</th>
              {data.closers.map((c, i) => (
                <th key={c.closer} className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="mr-1" aria-hidden="true">
                    {MEDALS[i] ?? `#${i + 1}`}
                  </span>
                  <span className="text-sm normal-case text-[var(--text-strong)]">{c.closer}</span>
                </th>
              ))}
              <th className="border-l border-[var(--panel-border)] px-4 py-3 text-right">Team</th>
            </tr>
          </thead>
          {GROUPS.map((group) => (
            <tbody key={group.title}>
              <tr className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)]">
                <td
                  colSpan={data.closers.length + 2}
                  className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]"
                >
                  {group.title}
                </td>
              </tr>
              {group.rows.map((row) => {
                const best = bestOf(row);
                return (
                  <tr key={row.key} className="border-b border-[var(--panel-border)]">
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--text-strong)]">{row.label}</div>
                      {row.note ? (
                        <div className="text-xs text-[var(--text-muted)] opacity-80">{row.note}</div>
                      ) : null}
                    </td>
                    {data.closers.map((c) => {
                      const value = c[row.key];
                      const isBest = best !== null && value === best && value !== 0;
                      return (
                        <td
                          key={c.closer}
                          className={`px-4 py-2 text-right whitespace-nowrap ${
                            isBest ? "font-bold text-emerald-400" : "text-[var(--text-strong)]"
                          }`}
                        >
                          {formatStatValue(value, row.format)}
                        </td>
                      );
                    })}
                    <td className="border-l border-[var(--panel-border)] px-4 py-2 text-right whitespace-nowrap text-[var(--text-muted)]">
                      {formatStatValue(data.team[row.key], row.format)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        High ticket closers only, ranked by cash collected. Counts and cash come from each
        closer&apos;s EOD report. Green marks the best closer on a row. Commission MTD, the closer&apos;s
        hourly rate and last month&apos;s figure don&apos;t move with the date range.
      </p>
    </div>
  );
}
