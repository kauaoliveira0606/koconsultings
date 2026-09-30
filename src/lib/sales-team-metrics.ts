import type { SpeedToLeadRow } from "./airtable/tables";
import { average, median } from "./metrics";
import { addDaysToDateString, easternDateString } from "./date-range";

/** The sales team's working hours, US Eastern. The speed-to-lead clock only runs inside them. */
export const WORK_START_HOUR_ET = 9;
export const WORK_END_HOUR_ET = 23;

/** Minutes ET is ahead of UTC at a given instant (negative: -240 in EDT, -300 in EST). */
function etOffsetMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wallAsUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** UTC instant of `hour`:00 Eastern on an Eastern calendar date (YYYY-MM-DD). */
function etWallToMs(ymd: string, hour: number): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  return guess - etOffsetMinutes(guess) * 60000;
}

/**
 * Minutes between two instants that fall inside working hours
 * (9am–11pm ET, every day). A 2am opt-in called at 9:03am is 3 minutes;
 * a 10:58pm opt-in called at 9:03am next day is 5.
 */
export function workingMinutesBetween(startMs: number, endMs: number): number {
  if (!(endMs > startMs)) return 0;
  let total = 0;
  const lastDay = easternDateString(new Date(endMs));
  for (let day = easternDateString(new Date(startMs)); day <= lastDay; day = addDaysToDateString(day, 1)) {
    const open = etWallToMs(day, WORK_START_HOUR_ET);
    const close = etWallToMs(day, WORK_END_HOUR_ET);
    const s = Math.max(startMs, open);
    const e = Math.min(endMs, close);
    if (e > s) total += e - s;
  }
  return total / 60000;
}

/** Re-time every called lead on working hours only (Airtable stores raw clock minutes). */
export function applyWorkingHours(rows: SpeedToLeadRow[]): SpeedToLeadRow[] {
  return rows.map((r) => {
    if (!r.firstCallAt || !r.createdAt) return r;
    const minutes = workingMinutesBetween(Date.parse(r.createdAt), Date.parse(r.firstCallAt));
    return { ...r, minutesToCall: Math.round(minutes * 10) / 10 };
  });
}

/**
 * The same person can exist as two GHL contacts. Collapse rows sharing a
 * phone number into one lead: the earliest opt-in, and the earliest first
 * call at or after it. Rows without a phone stay as they are.
 */
export function dedupeByPhone(rows: SpeedToLeadRow[]): SpeedToLeadRow[] {
  const byPhone = new Map<string, SpeedToLeadRow[]>();
  const out: SpeedToLeadRow[] = [];
  for (const r of rows) {
    if (!r.phone) {
      out.push(r);
      continue;
    }
    const group = byPhone.get(r.phone) ?? [];
    group.push(r);
    byPhone.set(r.phone, group);
  }
  for (const group of byPhone.values()) {
    const lead = [...group].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];
    const leadTime = lead.createdAt;
    const firstCall =
      group
        .map((r) => r.firstCallAt)
        .filter((t): t is string => !!t && (!leadTime || t >= leadTime))
        .sort()[0] ?? null;
    const minutesToCall =
      firstCall && leadTime
        ? Math.round(((Date.parse(firstCall) - Date.parse(leadTime)) / 60000) * 10) / 10
        : null;
    // Duplicate contacts are one person, so their calls add up.
    const addUp = (pick: (r: SpeedToLeadRow) => number | null) =>
      group.some((r) => pick(r) !== null) ? group.reduce((n, r) => n + (pick(r) ?? 0), 0) : null;
    out.push({
      ...lead,
      firstCallAt: firstCall,
      minutesToCall,
      calls: addUp((r) => r.calls),
      touchPoints: addUp((r) => r.touchPoints),
    });
  }
  return out;
}

/** Called leads only: a lead nobody has called yet has no time to average. */
export function avgSpeedToLead(rows: SpeedToLeadRow[]): number | null {
  return average(rows.filter((r) => r.firstCallAt).map((r) => r.minutesToCall));
}

/** Touch point density across every opt-in (a lead never called counts as 0). */
export function touchPointSummary(rows: SpeedToLeadRow[]): {
  avgTouchPoints: number | null;
  atFivePlus: number;
  atFivePlusRate: number | null;
  total: number;
} {
  const touches = rows.map((r) => r.touchPoints ?? 0);
  const atFivePlus = touches.filter((t) => t >= 5).length;
  return {
    avgTouchPoints: rows.length ? touches.reduce((a, b) => a + b, 0) / rows.length : null,
    atFivePlus,
    atFivePlusRate: rows.length ? atFivePlus / rows.length : null,
    total: rows.length,
  };
}

export function medianSpeedToLead(rows: SpeedToLeadRow[]): number | null {
  return median(rows.filter((r) => r.firstCallAt).map((r) => r.minutesToCall));
}

export function leadsCalledSummary(rows: SpeedToLeadRow[]): {
  called: number;
  total: number;
  notYetCalled: number;
  calledUnder5: number;
  under5Rate: number | null;
} {
  const called = rows.filter((r) => r.firstCallAt).length;
  const calledUnder5 = rows.filter(
    (r) => r.firstCallAt && r.minutesToCall !== null && r.minutesToCall < 5
  ).length;
  return {
    called,
    total: rows.length,
    notYetCalled: rows.length - called,
    calledUnder5,
    under5Rate: rows.length > 0 ? calledUnder5 / rows.length : null,
  };
}
