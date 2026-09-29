"use client";

import useSWR from "swr";
import { formatStatValue } from "@/lib/format";
import type { CellStatus, PacingPayload, PacingPeriod, PacingRow } from "@/lib/weekly-scorecard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_STYLE: Record<Exclude<CellStatus, null>, React.CSSProperties> = {
  green: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" },
  yellow: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  red: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" },
};

// Same orange as the Weekly Scorecard's cash rows.
const CASH_STYLE: React.CSSProperties = {
  background: "var(--cell-cash-bg)",
  color: "var(--cell-cash-text)",
};

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function goalText(row: PacingRow): string | null {
  if (row.goal === null || row.goalDirection === null) return null;
  return `${row.goalDirection === "higher" ? "≥" : "≤"} ${formatStatValue(row.goal, row.format)}`;
}

function cellClass(extra = "") {
  return `border border-[var(--panel-border)] px-2 py-1.5 text-right text-sm tabular-nums ${extra}`;
}

function PeriodTable({ period }: { period: PacingPeriod }) {
  const pct = period.daysTotal ? period.daysElapsed / period.daysTotal : 0;
  return (
    <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--text-strong)]">
          {period.key === "month" ? "Month" : "Week"} Pacing · {period.label}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {period.through
            ? `Through ${shortDate(period.through)} · ${period.daysElapsed} of ${period.daysTotal} days`
            : `No completed days yet · 0 of ${period.daysTotal} days`}
        </div>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--panel-subtle)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct * 100}%` }} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-2 py-1.5 text-left font-semibold">Metric</th>
              <th className="px-2 py-1.5 text-right font-semibold">To Date</th>
              <th className="px-2 py-1.5 text-right font-semibold">Daily Avg</th>
              <th className="px-2 py-1.5 text-right font-semibold">Pacing For</th>
              <th className="px-2 py-1.5 text-right font-semibold">{period.previousLabel}</th>
            </tr>
          </thead>
          <tbody>
            {period.rows.map((row) => {
              const base = row.cash ? CASH_STYLE : { color: "var(--text)" };
              const goal = goalText(row);
              return (
                <tr key={row.key}>
                  <th
                    className="px-2 py-1.5 text-left align-middle"
                    style={row.cash ? { boxShadow: "inset 4px 0 0 rgb(249, 115, 22)" } : undefined}
                  >
                    <span className="text-sm font-medium leading-tight text-[var(--text-strong)]">
                      {row.label}
                    </span>
                    {goal ? (
                      <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{goal}</span>
                    ) : null}
                  </th>
                  <td className={cellClass()} style={base}>
                    {formatStatValue(row.toDate, row.format)}
                  </td>
                  <td className={cellClass()} style={base}>
                    {row.kind === "rate" ? "—" : formatStatValue(row.dailyAvg, row.format)}
                  </td>
                  <td
                    className={cellClass("font-semibold")}
                    style={row.status ? STATUS_STYLE[row.status] : base}
                  >
                    {formatStatValue(row.projected, row.format)}
                  </td>
                  <td className={cellClass("text-[var(--text-muted)]")}>
                    {formatStatValue(row.previous, row.format)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Month and week pacing. Totals project the completed days' daily average
 * across the whole period; rates (ROAS, CPL, CPA) pace at their to-date value.
 * Not tied to the range filter: it's always the current month and week.
 */
export function PacingSection({ apiPath }: { apiPath: string }) {
  const { data } = useSWR<PacingPayload>(apiPath, fetcher);

  if (!data) {
    return <div className="text-sm text-[var(--text-muted)]">Loading pacing…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {data.periods.map((p) => (
        <PeriodTable key={p.key} period={p} />
      ))}
      <p className="text-xs text-[var(--text-muted)] xl:col-span-2">
        Pacing For = daily average of completed days × days in the period. Today never counts, and
        yesterday waits until its Marketing Daily Metrics form is in. ROAS, CPL and CPA pace at
        their to-date value.
      </p>
    </div>
  );
}
