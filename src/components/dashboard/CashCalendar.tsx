"use client";

import { useState } from "react";
import useSWR from "swr";
import { bucketIntensity } from "@/lib/cash-calendar";
import { formatStatValue } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const BUCKET_COLORS = [
  "bg-[var(--panel-subtle)]", // 0 - none
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
];

// The heat-map buckets go from a near-black "no data" tile up through light
// mint greens to a dark green — a single text color can't stay readable
// across that whole range, and the deepspace/violet themes' blanket
// text-black→white remap makes it worse by forcing white even onto the
// light green tiles. Pairing each bucket with its own explicit
// (non-remapped) text color keeps every tile readable regardless of theme.
const BUCKET_TEXT_COLORS = [
  "text-white",
  "text-slate-900",
  "text-slate-900",
  "text-slate-900",
  "text-white",
  "text-white",
];
const BUCKET_SUBTEXT_COLORS = [
  "text-white/70",
  "text-slate-900/60",
  "text-slate-900/60",
  "text-slate-900/60",
  "text-white/70",
  "text-white/70",
];

type CashCalendarResponse = {
  byDay: Record<string, number>;
  total: number;
  bySourceDay: Record<string, { paid: number; organic: number }>;
  adSpendByDay: Record<string, number>;
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
  const firstDay = new Date(year, m - 1, 1).getDay(); // 0 = Sunday
  return firstDay;
}

/** Shared Cash Calendar. Pass the offer's cash-calendar API path. */
export function CashCalendar({ apiPath }: { apiPath: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data } = useSWR<CashCalendarResponse>(`${apiPath}?month=${month}`, fetcher);

  const byDay = data?.byDay ?? {};
  const bySourceDay = data?.bySourceDay ?? {};
  const adSpendByDay = data?.adSpendByDay ?? {};
  const max = Math.max(0, ...Object.values(byDay));
  const days = daysInMonth(month);
  const blanks = leadingBlankCount(month);

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">
          Cash collected per day, Paid/Organic split, and Ad Spend all come from Marketing Daily
          Metrics submissions only (no Affiliate PCN/EOD cross-reference). Net Cash is collected
          minus ad spend. Paid + Organic always sums to the total.
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
            Month total: {formatStatValue(data?.total ?? null, "currency")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
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
              const value = byDay[date] ?? 0;
              const bucket = bucketIntensity(value, max);
              const source = bySourceDay[date];
              const adSpend = adSpendByDay[date] ?? 0;
              const netCash = value - adSpend;
              const subtextClass = BUCKET_SUBTEXT_COLORS[bucket];
              return (
                <div
                  key={date}
                  className={`flex h-32 flex-col gap-1 rounded-md border border-[var(--panel-border)] p-2 ${BUCKET_COLORS[bucket]} ${BUCKET_TEXT_COLORS[bucket]}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold">{day}</span>
                    {value > 0 ? (
                      <span className="text-right text-xs font-bold">
                        {formatStatValue(value, "currency")}
                      </span>
                    ) : null}
                  </div>
                  {value > 0 ? (
                    <div
                      className={`mt-auto grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] leading-tight ${subtextClass}`}
                    >
                      <div>
                        <div className="opacity-80">Paid</div>
                        <div className="font-semibold">
                          {formatStatValue(source?.paid ?? 0, "currency")}
                        </div>
                      </div>
                      <div>
                        <div className="opacity-80">Ad Spend</div>
                        <div className="font-semibold">{formatStatValue(adSpend, "currency")}</div>
                      </div>
                      <div>
                        <div className="opacity-80">Organic</div>
                        <div className="font-semibold">
                          {formatStatValue(source?.organic ?? 0, "currency")}
                        </div>
                      </div>
                      <div>
                        <div className="opacity-80">Net Cash</div>
                        <div className="font-semibold">{formatStatValue(netCash, "currency")}</div>
                      </div>
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
