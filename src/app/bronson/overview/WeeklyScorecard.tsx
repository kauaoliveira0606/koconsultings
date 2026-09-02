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

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const STATUS_STYLE: Record<Exclude<CellStatus, null>, React.CSSProperties> = {
  green: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" },
  yellow: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  red: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" },
};

function goalText(row: ScorecardRow): string | null {
  if (row.goal === null || row.goalDirection === null) return null;
  return `Goal ${formatStatValue(row.goal, row.format)}${row.goalDirection === "higher" ? "+" : " or less"}`;
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
    <td
      className="border border-[var(--panel-border)] px-2 py-1.5 text-right text-sm tabular-nums"
      style={
        status
          ? STATUS_STYLE[status]
          : { color: value === null ? "var(--text-muted)" : "var(--text)" }
      }
    >
      {formatStatValue(value, format)}
    </td>
  );
}

export function WeeklyScorecard() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const { data } = useSWR<WeeklyScorecardPayload>(
    `/api/bronson/overview/weekly-scorecard${weekStart ? `?weekStart=${weekStart}` : ""}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <DashboardSection title="Weekly Scorecard">
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => data && setWeekStart(isoAddDays(data.weekStart, -7))}
            disabled={!data}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel-subtle)] disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold text-[var(--text-strong)]">{data?.weekLabel ?? "…"}</span>
          <button
            type="button"
            onClick={() => data && setWeekStart(isoAddDays(data.weekStart, 7))}
            disabled={!data || data.isCurrentWeek}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel-subtle)] disabled:opacity-40"
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
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--panel-bg)] px-2 py-1.5 text-left text-xs font-semibold uppercase text-[var(--text-muted)] backdrop-blur-sm">
                    Metric
                  </th>
                  {data.dayDates.map((d, i) => {
                    const [, m, day] = d.split("-");
                    return (
                      <th
                        key={d}
                        className="border border-[var(--panel-border)] px-2 py-1.5 text-right text-xs font-semibold text-[var(--text-muted)]"
                      >
                        <div className="text-[var(--text)]">{DOW[i]}</div>
                        <div className="font-normal">{`${Number(m)}/${Number(day)}`}</div>
                      </th>
                    );
                  })}
                  <th className="border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-2 py-1.5 text-right text-xs font-semibold text-[var(--text)]">
                    WEEK
                  </th>
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
      <tr>
        <td
          colSpan={9}
          className="sticky left-0 bg-[var(--panel-subtle)] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
        >
          {emoji} {title}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key}>
          <th className="sticky left-0 z-10 bg-[var(--panel-bg)] px-2 py-1.5 text-left align-top backdrop-blur-sm">
            <div className="text-sm font-medium text-[var(--text-strong)]">{row.label}</div>
            {goalText(row) ? <div className="text-xs text-[var(--text-muted)]">{goalText(row)}</div> : null}
          </th>
          {row.days.map((cell) => (
            <Cell key={cell.date} value={cell.value} status={cell.status} format={row.format} />
          ))}
          <td
            className="border border-[var(--panel-border)] px-2 py-1.5 text-right text-sm font-semibold tabular-nums"
            style={
              row.week.status
                ? STATUS_STYLE[row.week.status]
                : { background: "var(--panel-subtle)", color: "var(--text)" }
            }
          >
            {formatStatValue(row.week.value, row.format)}
          </td>
        </tr>
      ))}
    </>
  );
}
