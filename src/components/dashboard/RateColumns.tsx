import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";

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

const STATUS_COLOR: Record<Exclude<StatCardStatus, null>, string> = {
  green: "var(--cell-green-bg)",
  yellow: "var(--cell-yellow-bg)",
  red: "var(--cell-red-bg)",
};

/**
 * A funnel laid out as columns: each column is one rate, shown big, with the
 * counts it is built from listed underneath, so the rate and its inputs are
 * read together instead of hunted for across a grid of cards.
 */
export function RateColumns({ columns }: { columns: RateColumn[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((c) => (
        <div
          key={c.title}
          className="flex flex-col rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm"
          style={c.status ? { borderColor: STATUS_COLOR[c.status], borderWidth: 2 } : undefined}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]">
              {c.title}
            </span>
            {c.status ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[c.status] }}
                aria-label={`KPI status: ${c.status}`}
              />
            ) : null}
          </div>
          <div className="flex-1 p-4">
            <div className="text-4xl font-bold text-[var(--text-strong)]">
              {formatStatValue(c.value, c.format ?? "percent")}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{c.formula}</div>
            {c.goal !== undefined ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Goal: {c.goal ?? "none set"}
              </div>
            ) : null}
          </div>
          <div className="space-y-2 border-t border-[var(--panel-border)] px-4 py-3">
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
