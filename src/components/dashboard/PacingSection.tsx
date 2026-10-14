"use client";

import useSWR from "swr";
import { formatStatValue } from "@/lib/format";
import { STATUS_TEXT_STYLE } from "@/components/dashboard/status";
import type { PacingPayload, PacingPeriod, PacingRow } from "@/lib/weekly-scorecard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());



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

function Pill({ text, style, bold }: { text: string; style?: React.CSSProperties; bold?: boolean }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 ${bold ? "font-bold" : "font-semibold"}`} style={style}>
      {text}
    </span>
  );
}

function PeriodTable({ period }: { period: PacingPeriod }) {
  const pct = period.daysTotal ? period.daysElapsed / period.daysTotal : 0;
  return (
    <div className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-[var(--text-muted)]">{period.key === "month" ? "Month" : "Week"} pacing</div>
          <div className="text-base font-semibold text-[var(--text-strong)]">{period.label}</div>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {period.through
            ? `Through ${shortDate(period.through)} · ${period.daysElapsed} of ${period.daysTotal} days`
            : `No completed days yet · 0 of ${period.daysTotal} days`}
        </div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-300 to-indigo-400"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06] [&_tbody_tr:nth-of-type(even)]:bg-white/[0.03]">
          <thead>
            <tr className="text-[13px] text-[var(--text-muted)]">
              <th className="px-3 py-2.5 text-left font-semibold">Metric</th>
              <th className="px-3 py-2.5 text-right font-semibold">Currently At</th>
              <th className="px-3 py-2.5 text-right font-semibold">Daily Avg</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pacing For</th>
            </tr>
          </thead>
          <tbody>
            {period.rows.map((row) => {
              const goal = goalText(row);
              return (
                <tr key={row.key} className={row.cash ? "bg-orange-400/[0.07]" : ""}>
                  <th
                    className="px-3 py-2.5 text-left align-middle"
                    style={row.cash ? { boxShadow: "inset 3px 0 0 rgb(251, 146, 60)" } : undefined}
                  >
                    <span className="font-medium leading-tight text-[var(--text-strong)]">{row.label}</span>
                    {goal ? <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{goal}</span> : null}
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="font-bold text-white">{formatStatValue(row.toDate, row.format)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text)]">
                    {row.kind === "rate" ? "—" : formatStatValue(row.dailyAvg, row.format)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.status ? (
                      <Pill text={formatStatValue(row.projected, row.format)} style={STATUS_TEXT_STYLE[row.status]} bold />
                    ) : (
                      <span className="font-semibold text-white">{formatStatValue(row.projected, row.format)}</span>
                    )}
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
        yesterday waits until its Marketing Daily Metrics form is in. Rates (ROAS, cost per lead) pace at
        their to-date value.
      </p>
    </div>
  );
}
