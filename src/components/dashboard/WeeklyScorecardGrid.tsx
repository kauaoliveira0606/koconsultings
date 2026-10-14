"use client";

import { useState } from "react";
import useSWR from "swr";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { formatStatValue } from "@/lib/format";
import type { WeeklyScorecardPayload, CellStatus, ScorecardRow } from "@/lib/weekly-scorecard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function isoAddDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLE: Record<Exclude<CellStatus, null>, React.CSSProperties> = {
  green: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" },
  yellow: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  red: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" },
};

// Cash-collected rows get a soft orange row tint and an orange edge on the
// label so they're easy to spot; KPI status shows as a colored pill.
function kpiText(row: ScorecardRow): string {
  if (row.goal === null || row.goalDirection === null) return "—";
  const v = formatStatValue(row.goal, row.format);
  return row.goalDirection === "higher" ? `≥ ${v}` : `≤ ${v}`;
}

function Value({
  value,
  status,
  format,
  bold,
}: {
  value: number | null;
  status: CellStatus;
  format: ScorecardRow["format"];
  bold?: boolean;
}) {
  const text = formatStatValue(value, format);
  if (status) {
    return (
      <span
        className={`inline-block rounded-md px-1.5 py-0.5 ${bold ? "font-semibold" : "font-medium"}`}
        style={STATUS_STYLE[status]}
      >
        {text}
      </span>
    );
  }
  return (
    <span className={`${bold ? "font-semibold text-white" : ""} ${value === null ? "text-[var(--text-muted)] opacity-50" : ""}`}>
      {text}
    </span>
  );
}

function Cell({
  value,
  status,
  format,
}: {
  value: number | null;
  status: CellStatus;
  format: ScorecardRow["format"];
}) {
  return (
    <td className="px-2 py-1.5 text-right text-[13px] tabular-nums text-[var(--text)]">
      <Value value={value} status={status} format={format} />
    </td>
  );
}

/** Shared weekly-scorecard grid. Pass the offer's scorecard API path. */
export function WeeklyScorecardGrid({ apiPath }: { apiPath: string }) {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const { data } = useSWR<WeeklyScorecardPayload>(
    `${apiPath}${weekStart ? `?weekStart=${weekStart}` : ""}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <DashboardSection title="Weekly Scorecard">
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => data && setWeekStart(isoAddDays(data.weekStart, -7))}
            disabled={!data}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-white/10 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-2 text-base font-semibold text-[var(--text-strong)]">{data?.weekLabel ?? "…"}</span>
          <button
            type="button"
            onClick={() => data && setWeekStart(isoAddDays(data.weekStart, 7))}
            disabled={!data || data.isCurrentWeek}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-white/10 disabled:opacity-40"
          >
            Next →
          </button>
          <span className="ml-auto flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <Swatch varName="--cell-green-bg" label="At KPI" />
            <Swatch varName="--cell-yellow-bg" label="Within 20%" />
            <Swatch varName="--cell-red-bg" label="Off by 20%+" />
          </span>
        </div>

        {data ? (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.06]">
              <colgroup>
                <col style={{ width: "210px" }} />
                {data.dayDates.map((d) => (
                  <col key={d} style={{ width: "86px" }} />
                ))}
                <col style={{ width: "100px" }} />
                <col style={{ width: "80px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--panel-solid,#111c38)] px-2 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">
                    Metric
                  </th>
                  {data.dayDates.map((d, i) => {
                    const [, m, day] = d.split("-");
                    return (
                      <th key={d} className="px-2 py-2 text-right text-xs font-semibold text-[var(--text-muted)]">
                        <div className="text-[var(--text)]">{DOW[i]}</div>
                        <div className="font-normal">{`${Number(m)}/${Number(day)}`}</div>
                      </th>
                    );
                  })}
                  <th className="rounded-t-lg bg-sky-300/10 px-2 py-2 text-right text-xs font-semibold text-sky-200">
                    Week
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-[var(--text-muted)]">KPI</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group) => (
                  <GroupRows key={group.title} emoji={group.emoji} title={group.title} rows={group.rows} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DashboardSection>
  );
}

function Swatch({ varName, label }: { varName: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-[var(--panel-border)]"
        style={{ background: `var(${varName})` }}
      />
      {label}
    </span>
  );
}

function GroupRows({ emoji, title, rows }: { emoji: string; title: string; rows: ScorecardRow[] }) {
  return (
    <>
      <tr className="!border-b-0">
        <td colSpan={10} className="sticky left-0 px-2 pb-2 pt-6 text-sm font-semibold text-white">
          <span className="mr-1.5">{emoji}</span>
          {title}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className={row.cash ? "bg-orange-400/[0.07]" : ""}>
          <th
            className="sticky left-0 z-10 bg-[var(--panel-solid,#111c38)] px-2 py-1.5 text-left align-middle"
            style={row.cash ? { boxShadow: "inset 3px 0 0 rgb(251, 146, 60)" } : undefined}
          >
            <span className="text-[13px] font-medium leading-tight text-[var(--text-strong)]">{row.label}</span>
          </th>
          {row.days.map((cell) => (
            <Cell key={cell.date} value={cell.value} status={cell.status} format={row.format} />
          ))}
          <td className="bg-sky-300/10 px-2 py-1.5 text-right text-[13px] tabular-nums">
            <Value value={row.week.value} status={row.week.status} format={row.format} bold />
          </td>
          <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums text-[var(--text-muted)]">
            {kpiText(row)}
          </td>
        </tr>
      ))}
    </>
  );
}
