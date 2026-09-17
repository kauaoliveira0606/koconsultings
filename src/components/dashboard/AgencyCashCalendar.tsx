"use client";

import { useState } from "react";
import useSWR from "swr";
import { bucketIntensity } from "@/lib/cash-calendar";
import { formatStatValue } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const BUCKET_COLORS = [
  "bg-[var(--panel-subtle)]",
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
];
const BUCKET_TEXT_COLORS = ["text-white", "text-slate-900", "text-slate-900", "text-slate-900", "text-white", "text-white"];
const BUCKET_SUBTEXT_COLORS = [
  "text-white/70",
  "text-slate-900/60",
  "text-slate-900/60",
  "text-slate-900/60",
  "text-white/70",
  "text-white/70",
];

type DayEntry = {
  agencyProfit: number;
  totalCash: number;
  myProfit: number;
  byClient: { bronson: number; aval: number; ecomSimulation: number };
};

type CashCalendarResponse = {
  byDay: Record<string, DayEntry>;
  monthTotal: { agencyProfit: number; totalCash: number; myProfit: number };
};

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): { date: string; day: number }[] {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(year, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
  }));
}

function leadingBlankCount(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).getDay();
}

/**
 * Evergreen — always browsable by month regardless of whatever preset is
 * selected in the page's global date range picker up top.
 */
export function AgencyCashCalendar() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data } = useSWR<CashCalendarResponse>(
    `/api/agency/overview/cash-calendar?month=${month}`,
    fetcher
  );

  const byDay = data?.byDay ?? {};
  const max = Math.max(0, ...Object.values(byDay).map((d) => d.agencyProfit));
  const days = daysInMonth(month);
  const blanks = leadingBlankCount(month);

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">
          Per day: Agency Profit (bold), then Total Cash across all offers and your personal
          take-home below it, plus each client&apos;s Agency Profit contribution.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel-subtle)]"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold text-[var(--text-strong)]">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel-subtle)]"
          >
            Next →
          </button>
          <span className="text-sm font-semibold text-[var(--text-strong)]">
            Month Agency Profit: {formatStatValue(data?.monthTotal?.agencyProfit ?? null, "currency")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: blanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map(({ day, date }) => {
              const entry = byDay[date];
              const bucket = bucketIntensity(entry?.agencyProfit ?? 0, max);
              return (
                <div
                  key={date}
                  className={`flex h-32 flex-col justify-between rounded-md border border-[var(--panel-border)] p-2 ${BUCKET_COLORS[bucket]} ${BUCKET_TEXT_COLORS[bucket]}`}
                >
                  <span className="text-xs font-semibold">{day}</span>
                  {entry && entry.agencyProfit !== 0 ? (
                    <span className="text-right text-sm font-bold">
                      {formatStatValue(entry.agencyProfit, "currency")}
                    </span>
                  ) : null}
                  {entry && (entry.totalCash !== 0 || entry.myProfit !== 0) ? (
                    <div className={`text-right text-[10px] leading-tight ${BUCKET_SUBTEXT_COLORS[bucket]}`}>
                      <div>Cash: {formatStatValue(entry.totalCash, "currency")}</div>
                      <div>Me: {formatStatValue(entry.myProfit, "currency")}</div>
                    </div>
                  ) : null}
                  {entry &&
                  (entry.byClient.bronson !== 0 ||
                    entry.byClient.aval !== 0 ||
                    entry.byClient.ecomSimulation !== 0) ? (
                    <div className={`text-right text-[10px] leading-tight ${BUCKET_SUBTEXT_COLORS[bucket]}`}>
                      <div>B: {formatStatValue(entry.byClient.bronson, "currency")}</div>
                      <div>A: {formatStatValue(entry.byClient.aval, "currency")}</div>
                      <div>E: {formatStatValue(entry.byClient.ecomSimulation, "currency")}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
        <span>Less</span>
        {BUCKET_COLORS.map((color, i) => (
          <span key={i} className={`h-3 w-3 rounded-sm ${color}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
