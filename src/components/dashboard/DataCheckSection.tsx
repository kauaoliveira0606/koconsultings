"use client";

import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type { DataCheckFlag, DataCheckResponse } from "@/lib/data-check";

const METRIC_LABELS: Record<DataCheckFlag["metric"], string> = {
  highTicket: "High Ticket Cash",
  lowTicket: "Low Ticket Cash",
};

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function FlagRow({ flag }: { flag: DataCheckFlag }) {
  const money = (value: number) => formatStatValue(value, "currency");
  const over = flag.diff > 0;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-sm text-[var(--text-strong)]">
          <span className="font-semibold">{METRIC_LABELS[flag.metric]}:</span> {flag.source} says{" "}
          {money(flag.sourceCash)}, Marketing Daily Metrics{" "}
          {flag.formCash === null ? "has no entry" : `says ${money(flag.formCash)}`}
        </div>
        <div className={`text-sm font-semibold ${over ? "text-red-400" : "text-amber-400"}`}>
          {over
            ? `${money(flag.diff)} missing from the form`
            : `${money(-flag.diff)} missing from ${flag.source}`}
        </div>
      </div>
      {flag.hint ? <div className="mt-0.5 text-xs text-[var(--text-muted)]">{flag.hint}</div> : null}
    </li>
  );
}

/**
 * Flags every day in the selected range where a team log (Post Call Notes,
 * Follow Up Payment, EOD Closer, Affiliate PCN, Affiliate EOD) disagrees with
 * the Marketing Daily Metrics form on cash collected.
 */
export function DataCheckSection({ apiPath, range }: { apiPath: string; range: RangeState }) {
  const { data, error } = useSectionData<DataCheckResponse>(apiPath, range);

  if (!data) {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-muted)] backdrop-blur-sm">
        {error ? "Couldn't load, retrying…" : "Checking the logs against the form…"}
      </div>
    );
  }

  if (data.flagCount === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-[var(--text-strong)] backdrop-blur-sm">
        <span className="font-semibold text-emerald-400">All clear.</span> Every log matches the
        Marketing Daily Metrics form for this range (checked through {formatDay(data.checkedThrough)}).
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-red-400">
          {data.flagCount} mismatch{data.flagCount === 1 ? "" : "es"} across {data.days.length} day
          {data.days.length === 1 ? "" : "s"}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Logs vs the Marketing Daily Metrics form, checked through {formatDay(data.checkedThrough)}.
          Today is skipped.
        </div>
      </div>
      <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
        {data.days.map((day) => (
          <div
            key={day.date}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {formatDay(day.date)}
              </div>
              {!day.formLogged ? (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                  No form entry
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-[var(--panel-border)]">
              {day.flags.map((flag) => (
                <FlagRow key={`${flag.metric}-${flag.source}`} flag={flag} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
