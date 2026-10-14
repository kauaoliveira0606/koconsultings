"use client";

import { RANGE_PRESET_LABELS, type RangePreset } from "@/lib/date-range";

const PRESET_ORDER: RangePreset[] = [
  "today",
  "yesterday",
  "last_3_days",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "all_time",
];

export type RangeState = {
  preset: RangePreset;
  customStart: string;
  customEnd: string;
};

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
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-1">
        {presets.map((preset) => {
          const active = value.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ ...value, preset })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)] shadow-[0_4px_14px_-4px_rgba(142,197,255,0.6)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--text-strong)]"
              }`}
            >
              {RANGE_PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>
      {showCustom ? (
        <div
          className={`flex items-center gap-1.5 rounded-xl border p-1 text-sm text-[var(--text-muted)] ${
            value.preset === "custom"
              ? "border-[var(--accent)] bg-[var(--panel-subtle)]"
              : "border-[var(--panel-border)] bg-[var(--panel-subtle)]"
          }`}
        >
          <input
            type="date"
            aria-label="Custom range start"
            value={value.customStart}
            onChange={(e) =>
              onChange({ ...value, preset: "custom", customStart: e.target.value })
            }
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text)]"
          />
          <span className="px-0.5">to</span>
          <input
            type="date"
            aria-label="Custom range end"
            value={value.customEnd}
            onChange={(e) => onChange({ ...value, preset: "custom", customEnd: e.target.value })}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text)]"
          />
        </div>
      ) : null}
    </div>
  );
}

export function defaultRangeState(preset: RangePreset = "all_time"): RangeState {
  return { preset, customStart: "", customEnd: "" };
}
