"use client";

import { useState } from "react";
import useSWR from "swr";
import { bucketIntensity } from "@/lib/cash-calendar";
import { formatStatValue } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const BUCKET_COLORS = [
  "bg-white/5", // 0 - none
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
];

// Bucket cells always use a light-to-medium green ramp regardless of page
// theme, so their text needs its own contrast — light on the empty/dark
// cell, dark everywhere the tint itself is light enough.
const BUCKET_TEXT_COLORS = [
  "text-white/40",
  "text-black/70",
  "text-black/70",
  "text-black/80",
  "text-black",
  "text-black",
];

type CashCalendarResponse = {
  byDay: Record<string, number>;
  total: number;
  bySourceDay: Record<string, { paid: number; organic: number; unattributed: number }>;
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

export function CashCalendar() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data } = useSWR<CashCalendarResponse>(
    `/api/aval/overview/cash-calendar?month=${month}`,
    fetcher
  );

  const byDay = data?.byDay ?? {};
  const bySourceDay = data?.bySourceDay ?? {};
  const max = Math.max(0, ...Object.values(byDay));
  const days = daysInMonth(month);
  const blanks = leadingBlankCount(month);

  return (
    <div className="rounded-lg border border-white/10 bg-[#111826] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/60">
          Cash collected per day, from EOD Closer + Follow Up Payment submissions. Paid/Organic/
          Unattributed split below each day is the Post Call Note cross-reference (may not sum to
          the same total — independently submitted sources; Unattributed = closed calls whose
          email didn&apos;t match a lead).
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md border border-white/10 px-2 py-1 text-sm hover:bg-white/10"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md border border-white/10 px-2 py-1 text-sm hover:bg-white/10"
          >
            Next →
          </button>
          <span className="text-sm font-semibold">
            Month total: {formatStatValue(data?.total ?? null, "currency")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-white/50">
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
              return (
                <div
                  key={date}
                  className={`flex h-24 flex-col justify-between rounded-md border border-white/5 p-2 ${BUCKET_COLORS[bucket]} ${BUCKET_TEXT_COLORS[bucket]}`}
                >
                  <span className="text-xs font-semibold">{day}</span>
                  {value > 0 ? (
                    <span className="text-right text-xs font-bold">{formatStatValue(value, "currency")}</span>
                  ) : null}
                  {source && (source.paid > 0 || source.organic > 0 || source.unattributed > 0) ? (
                    <div className="text-right text-[10px] leading-tight opacity-80">
                      {source.paid > 0 ? <div>P: {formatStatValue(source.paid, "currency")}</div> : null}
                      {source.organic > 0 ? (
                        <div>O: {formatStatValue(source.organic, "currency")}</div>
                      ) : null}
                      {source.unattributed > 0 ? (
                        <div>U: {formatStatValue(source.unattributed, "currency")}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-white/50">
        <span>Less</span>
        {BUCKET_COLORS.map((color, i) => (
          <span key={i} className={`h-3 w-3 rounded-sm ${color}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
