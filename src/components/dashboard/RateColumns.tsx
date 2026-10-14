import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { StatusBar, StatusPill } from "@/components/dashboard/status";

export type RateColumn = {
  title: string;
  /** The headline rate for this column. */
  value: number | null | undefined;
  format?: StatFormat;
  /** How the rate is worked out, in words. */
  formula: string;
  /** The counts the rate is built from, top (numerator) to bottom. */
  inputs: { label: string; value: number | null | undefined; format?: StatFormat; note?: string }[];
  status?: StatCardStatus;
  goal?: string | null;
};

/**
 * A funnel laid out as columns: each column is one rate, shown big, with the
 * counts it is built from listed underneath, so the rate and its inputs are
 * read together instead of hunted for across a grid of cards.
 */
export function RateColumns({ columns }: { columns: RateColumn[] }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
        columns.length >= 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4"
      }`}
    >
      {columns.map((c) => (
        <div
          key={c.title}
          className="relative flex flex-col overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm"
        >
          {c.status ? <StatusBar status={c.status} /> : null}
          <div className="flex items-start justify-between gap-2 px-5 pt-5">
            <span className="text-sm font-semibold text-[var(--text-strong)]">{c.title}</span>
            {c.status ? <StatusPill status={c.status} /> : null}
          </div>
          <div className="flex-1 px-5 pb-4 pt-2">
            <div className="text-4xl font-semibold tracking-tight text-[var(--text-strong)]">
              {formatStatValue(c.value, c.format ?? "percent")}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{c.formula}</div>
            {c.goal !== undefined ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">Goal: {c.goal ?? "none set"}</div>
            ) : null}
          </div>
          <div className="space-y-2.5 border-t border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-4">
            {c.inputs.map((input) => (
              <div key={input.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[var(--text-muted)]">{input.label}</span>
                  <span className="font-semibold text-[var(--text-strong)]">
                    {formatStatValue(input.value, input.format ?? "number")}
                  </span>
                </div>
                {input.note ? (
                  <div className="text-xs text-[var(--text-muted)] opacity-80">{input.note}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
