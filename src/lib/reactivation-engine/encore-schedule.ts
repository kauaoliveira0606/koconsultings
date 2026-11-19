/** Pure schedule + wording for the Encore no-show text (no imports from the app, so it is unit tested). */

/** Keep in step with /encore/index.html (MASTERCLASS_DAYS / HOUR) and the AEvent recurring entry (campaign awSPuZl1HKdhVV4). */
const ENCORE_DAYS = [0, 2, 3, 5, 6];
const ENCORE_HOUR = 20;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY = 86_400_000;

/** Eastern wall time to a UTC timestamp, DST included. */
function easternToUtc(y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo, d, h, mi);
  const at = (timeZone: string) => new Date(new Date(guess).toLocaleString("en-US", { timeZone })).getTime();
  return guess + (at("UTC") - at("America/New_York"));
}

type Ymd = { y: number; m: number; d: number };
const nyYmd = (t: number): Ymd => {
  const [y, m, d] = new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return { y, m, d };
};
const ymdNum = (v: Ymd) => Date.UTC(v.y, v.m - 1, v.d);

/** The next Encore session that has not started yet (same rule as the page and AEvent's "soonest upcoming"). */
export function nextEncore(now = Date.now()): { startsAt: number; day: Ymd; dayName: string } {
  const today = nyYmd(now);
  for (let add = 0; add < 9; add++) {
    const utc = new Date(Date.UTC(today.y, today.m - 1, today.d + add));
    if (!ENCORE_DAYS.includes(utc.getUTCDay())) continue;
    const startsAt = easternToUtc(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), ENCORE_HOUR, 0);
    if (startsAt > now) return { startsAt, day: { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() }, dayName: DAY_NAMES[utc.getUTCDay()] };
  }
  throw new Error("no Encore session found");
}

/** "tonight", "tomorrow" or the weekday, then the time: the words the text uses. */
export function whenWords(now = Date.now()): string {
  const n = nextEncore(now);
  const days = Math.round((ymdNum(n.day) - ymdNum(nyYmd(now))) / DAY);
  const day = days === 0 ? "tonight" : days === 1 ? "tomorrow" : n.dayName;
  return `${day} at 8pm est`;
}

/** The one text. User's wording (2026-11-17, "pop up masterclass" added 2026-11-19): acknowledge the miss, offer a private invite, ask to save the seat. No "tonight" about the miss itself, since a text can go out the next day. */
export function noShowText(first: string | null, now = Date.now()): string {
  return `Hey${first ? ` ${first}` : ""}, saw you missed the masterclass, no worries. I can give you a private invite for ${whenWords(now).replace(" at 8pm est", " pop up masterclass at 8pm est")}. I'm hosting one more for people that missed it. Want me to save your seat?`;
}

/** 9 AM to 10:45 PM Eastern: the night-of text goes out after the 8 PM session, never in the small hours. */
export function inSendWindow(now = Date.now()): boolean {
  const h = Number(new Date(now).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }));
  const m = Number(new Date(now).toLocaleString("en-US", { timeZone: "America/New_York", minute: "numeric" }));
  const mins = h * 60 + m;
  return mins >= 9 * 60 && mins <= 22 * 60 + 45;
}

