"use client";

import { RANGE_PRESET_LABELS, type RangePreset } from "@/lib/date-range";

const PRESET_ORDER: RangePreset[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "last_30_days",
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
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ ...value, preset })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value.preset === preset
              ? "bg-[var(--text-strong)] text-[var(--panel-bg)]"
              : "bg-[var(--panel-bg)] text-[var(--text-muted)] border border-[var(--panel-border)] hover:bg-[var(--panel-subtle)]"
          }`}
        >
          {RANGE_PRESET_LABELS[preset]}
        </button>
      ))}
      {showCustom ? (
        <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
          <input
            type="date"
            value={value.customStart}
            onChange={(e) =>
              onChange({ ...value, preset: "custom", customStart: e.target.value })
            }
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text)]"
          />
          <span>to</span>
          <input
            type="date"
            value={value.customEnd}
            onChange={(e) => onChange({ ...value, preset: "custom", customEnd: e.target.value })}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[var(--text)]"
          />
        </div>
      ) : null}
    </div>
  );
}

export function defaultRangeState(preset: RangePreset = "all_time"): RangeState {
  return { preset, customStart: "", customEnd: "" };
}
