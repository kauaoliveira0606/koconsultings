import type { NextRequest } from "next/server";
import { resolveRange, type RangePreset, type ResolvedRange } from "./date-range";

const VALID_PRESETS: RangePreset[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "last_30_days",
  "all_time",
  "custom",
];

export function parseRangeFromRequest(request: NextRequest): ResolvedRange {
  const searchParams = request.nextUrl.searchParams;
  const presetParam = searchParams.get("preset") as RangePreset | null;
  const preset = presetParam && VALID_PRESETS.includes(presetParam) ? presetParam : "all_time";

  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (preset === "custom" && start && end) {
    return resolveRange("custom", { start, end });
  }
  return resolveRange(preset);
}
