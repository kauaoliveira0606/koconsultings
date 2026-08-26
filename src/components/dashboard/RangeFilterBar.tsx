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
              ? "bg-black text-white"
              : "bg-white text-black/70 border border-black/10 hover:bg-black/5"
          }`}
        >
          {RANGE_PRESET_LABELS[preset]}
        </button>
      ))}
      {showCustom ? (
        <div className="flex items-center gap-1 text-sm text-black/60">
          <input
            type="date"
            value={value.customStart}
            onChange={(e) =>
              onChange({ ...value, preset: "custom", customStart: e.target.value })
            }
            className="rounded-md border border-black/10 bg-white px-2 py-1"
          />
          <span>to</span>
          <input
            type="date"
            value={value.customEnd}
            onChange={(e) => onChange({ ...value, preset: "custom", customEnd: e.target.value })}
            className="rounded-md border border-black/10 bg-white px-2 py-1"
          />
        </div>
      ) : null}
    </div>
  );
}

export function defaultRangeState(preset: RangePreset = "all_time"): RangeState {
  return { preset, customStart: "", customEnd: "" };
}
