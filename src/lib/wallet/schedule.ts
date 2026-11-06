import type { WalletEvent } from "./config";

/** Wall-clock parts of an instant in a timezone. */
function zoneParts(date: Date, timeZone: string) {
  const out: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  })
    .formatToParts(date)
    .forEach((p) => (out[p.type] = p.value));
  return out;
}

function zoneOffset(date: Date, timeZone: string): number {
  const p = zoneParts(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant a wall-clock time (given as UTC fields) happens in `timeZone`. */
function wall(wallUtc: number, timeZone: string): Date {
  const guess = new Date(wallUtc - zoneOffset(new Date(wallUtc), timeZone));
  return new Date(wallUtc - zoneOffset(guess, timeZone));
}

/** Local midnight at the end of the day `date` falls on. */
export function dayEnd(date: Date, timeZone: string): Date {
  const p = zoneParts(date, timeZone);
  return wall(Date.UTC(+p.year, +p.month - 1, +p.day + 1, 0, 0, 0), timeZone);
}

/**
 * The session a pass points at right now. A session stays current through the
 * whole local day it runs (like the confirmation page), then rolls to the next
 * week. One event, rolling forward, so the claim link never changes.
 */
export function currentSession(ev: WalletEvent, now = new Date()): { start: Date; end: Date } {
  let start: Date | null = null;
  if (ev.pinnedDate) {
    const [y, m, d] = ev.pinnedDate.split("-").map(Number);
    const pinned = wall(Date.UTC(y, m - 1, d, ev.hour, ev.minute, 0), ev.timeZone);
    if (dayEnd(pinned, ev.timeZone) > now) start = pinned;
  }
  if (!start) {
    const p = zoneParts(now, ev.timeZone);
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const days = (ev.weekday - dow + 7) % 7;
    start = wall(Date.UTC(+p.year, +p.month - 1, +p.day + days, ev.hour, ev.minute, 0), ev.timeZone);
    if (dayEnd(start, ev.timeZone) <= now) {
      start = wall(Date.UTC(+p.year, +p.month - 1, +p.day + days + 7, ev.hour, ev.minute, 0), ev.timeZone);
    }
  }
  return { start, end: new Date(start.getTime() + ev.durationMinutes * 60000) };
}

/** The session before the current one (for knowing when the pass rolled). */
export function previousSessionEnd(ev: WalletEvent, now = new Date()): Date {
  const { start } = currentSession(ev, now);
  let prevStart = new Date(start.getTime() - 7 * 864e5);
  // Local midnight after the previous session is when this one became current.
  // A pinned date can skip a week, which would put that moment in the future;
  // step back whole weeks so it is always a stable time in the past.
  let end = dayEnd(prevStart, ev.timeZone);
  while (end > now) {
    prevStart = new Date(prevStart.getTime() - 7 * 864e5);
    end = dayEnd(prevStart, ev.timeZone);
  }
  return end;
}

/** "3 hours", "90 minutes", "1 hour": from the real lead time, never rounded. */
export function leadLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

export type Phase = "confirmed" | "tomorrow" | "lead" | "now" | "ended";

/** Where we are relative to the session, and when that state began. */
export function phase(ev: WalletEvent, now = new Date()) {
  const { start, end } = currentSession(ev, now);
  const t = now.getTime();
  const s = start.getTime();
  const marks = {
    tomorrow: s - 24 * 3600e3,
    lead: s - ev.leadMinutes * 60e3,
    now: s - 15 * 60e3,
    ended: end.getTime(),
  };
  let p: Phase = "confirmed";
  let since = previousSessionEnd(ev, now).getTime();
  if (t >= marks.ended) [p, since] = ["ended", marks.ended];
  else if (t >= marks.now) [p, since] = ["now", marks.now];
  else if (t >= marks.lead) [p, since] = ["lead", marks.lead];
  else if (t >= marks.tomorrow) [p, since] = ["tomorrow", marks.tomorrow];
  return { phase: p, since: new Date(since), start, end, marks };
}

export function statusText(ev: WalletEvent, p: Phase): string {
  switch (p) {
    case "tomorrow":
      return "Starts tomorrow";
    case "lead":
      return `Starts in ${leadLabel(ev.leadMinutes)}`;
    case "now":
      return "Starting now";
    case "ended":
      return "See you next week";
    default:
      return "Confirmed";
  }
}

/** W3C date with a colon in the offset (+00:00), which Apple requires. */
export function w3c(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}
