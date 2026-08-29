"use client";

import type { ReactNode } from "react";
import { RANGE_PRESET_LABELS, type RangePreset } from "@/lib/date-range";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { formatStatValue, type StatFormat } from "@/lib/format";

export { defaultRangeState, type RangeState } from "@/components/dashboard/RangeFilterBar";

/**
 * Dark, trading-terminal-styled counterparts to the shared white-card
 * dashboard primitives (@/components/dashboard/*), scoped to Aval only —
 * Bronson and Ecom Simulation keep the original light theme.
 */

export function StatCard({
  label,
  value,
  format = "number",
  subtext,
  goal,
}: {
  label: string;
  value: number | null | undefined;
  format?: StatFormat;
  subtext?: string;
  goal?: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111826] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-emerald-400">
        {formatStatValue(value, format)}
      </div>
      {subtext ? <div className="mt-1 text-xs text-white/40">{subtext}</div> : null}
      {goal !== undefined ? (
        <div className="mt-1 text-xs text-white/40">{goal ?? "No goal set"}</div>
      ) : null}
    </div>
  );
}

export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {children}
    </div>
  );
}

export function DashboardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "No data yet.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#111826] p-6 text-center text-sm text-white/40">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111826]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase text-white/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-white/5 last:border-0">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 font-mono text-white/90 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PRESET_ORDER: RangePreset[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "last_30_days",
  "all_time",
];

export function RangeFilterBar({
  value,
  onChange,
  presets = PRESET_ORDER,
  showCustom = true,
}: {
  value: RangeState;
  onChange: (next: RangeState) => void;
  presets?: RangePreset[];
  showCustom?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ ...value, preset })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value.preset === preset
              ? "bg-emerald-500 text-black"
              : "border border-white/10 bg-[#111826] text-white/70 hover:bg-white/10"
          }`}
        >
          {RANGE_PRESET_LABELS[preset]}
        </button>
      ))}
      {showCustom ? (
        <div className="flex items-center gap-1 text-sm text-white/50">
          <input
            type="date"
            value={value.customStart}
            onChange={(e) => onChange({ ...value, preset: "custom", customStart: e.target.value })}
            className="rounded-md border border-white/10 bg-[#111826] px-2 py-1 text-white [color-scheme:dark]"
          />
          <span>to</span>
          <input
            type="date"
            value={value.customEnd}
            onChange={(e) => onChange({ ...value, preset: "custom", customEnd: e.target.value })}
            className="rounded-md border border-white/10 bg-[#111826] px-2 py-1 text-white [color-scheme:dark]"
          />
        </div>
      ) : null}
    </div>
  );
}
