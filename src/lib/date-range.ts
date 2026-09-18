export type RangePreset =
  | "today"
  | "yesterday"
  | "last_3_days"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "all_time"
  | "custom";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_3_days: "Last 3 Days",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  this_month: "This Month",
  last_month: "Last Month",
  all_time: "All Time",
  custom: "Custom",
};

export type ResolvedRange = { start: string | null; end: string | null };

/**
 * The whole dashboard runs on US Eastern. "Today", "Last 3 Days", every
 * bucket boundary, and every displayed timestamp are Eastern-calendar,
 * regardless of where the server (UTC on Vercel) or the viewer sits.
 */
export const BUSINESS_TIME_ZONE = "America/New_York";

/** `YYYY-MM-DD` for the given instant in US Eastern. */
export function easternDateString(d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Add (or subtract) whole days to a `YYYY-MM-DD` string. Pure calendar math. */
export function addDaysToDateString(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Normalizes any Airtable date value to the `YYYY-MM-DD` it falls on in
 * US Eastern. A value with a time component (`...T..:..Z`) is converted;
 * a bare `YYYY-MM-DD` (the team's manually-entered daily-log dates) is
 * already a business day and passed through untouched.
 */
export function toEasternDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 10 || !value.includes("T")) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return easternDateString(d);
}

/** Full calendar month (first through last day) for a `YYYY-MM` string. */
function monthBounds(month: string): ResolvedRange {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Resolves a preset (or custom start/end) into an inclusive [start, end]
 * range of Eastern calendar dates. `null`/`null` means "all time".
 */
export function resolveRange(
  preset: RangePreset,
  custom?: { start: string; end: string },
  now: Date = new Date()
): ResolvedRange {
  const today = easternDateString(now);

  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = addDaysToDateString(today, -1);
      return { start: y, end: y };
    }
    case "last_3_days":
      return { start: addDaysToDateString(today, -2), end: today };
    case "last_7_days":
      return { start: addDaysToDateString(today, -6), end: today };
    case "last_30_days":
      return { start: addDaysToDateString(today, -29), end: today };
    case "this_month":
      return monthBounds(today.slice(0, 7));
    case "last_month":
      return monthBounds(addDaysToDateString(`${today.slice(0, 7)}-01`, -1).slice(0, 7));
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
