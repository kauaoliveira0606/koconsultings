export type RangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "last_30_days"
  | "all_time"
  | "custom";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  all_time: "All Time",
  custom: "Custom",
};

export type ResolvedRange = { start: string | null; end: string | null };

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Resolves a preset (or custom start/end) into an inclusive [start, end]
 * ISO-date range. `null`/`null` means "all time" (no filtering).
 *
 * "This Week" starts Monday. All comparisons are done on calendar dates
 * (no timezone conversion) — callers should treat Airtable `Date` fields
 * as already being in the business's operating date, not convert them.
 */
export function resolveRange(
  preset: RangePreset,
  custom?: { start: string; end: string },
  now: Date = new Date()
): ResolvedRange {
  const today = startOfDay(now);

  switch (preset) {
    case "today":
      return { start: toIsoDate(today), end: toIsoDate(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: toIsoDate(y), end: toIsoDate(y) };
    }
    case "this_week": {
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      const monday = addDays(today, -daysSinceMonday);
      return { start: toIsoDate(monday), end: toIsoDate(today) };
    }
    case "last_7_days":
      return { start: toIsoDate(addDays(today, -6)), end: toIsoDate(today) };
    case "last_30_days":
      return { start: toIsoDate(addDays(today, -29)), end: toIsoDate(today) };
    case "all_time":
      return { start: null, end: null };
    case "custom":
      if (!custom) return { start: null, end: null };
      return { start: custom.start, end: custom.end };
    default:
      return { start: null, end: null };
  }
}

export function isDateInRange(date: string | null, range: ResolvedRange): boolean {
  if (!date) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}
