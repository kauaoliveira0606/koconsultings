import { addDaysToDateString } from "@/lib/date-range";

/**
 * The webinars each offer has run or planned (user, 2026-10-19). Each one is a
 * promo period that ends on the webinar day. A promo always starts the day after
 * the previous webinar (user, 2026-10-28), so only the first webinar needs its
 * promo start written down. Add the next date here once it is set.
 */
export type WebinarRun = { promoStart: string; date: string };

export type WebinarOffer = "bronson" | "aval";

/** Promo length used for a first webinar with no promo start on record. */
export const DEFAULT_PROMO_DAYS = 5;

/** Sorts runs by date and starts every promo after the first the day after the previous webinar. */
export function chainPromos(runs: { date: string; promoStart?: string }[]): WebinarRun[] {
  const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((r, i) => ({
    date: r.date,
    promoStart:
      i > 0
        ? addDaysToDateString(sorted[i - 1].date, 1)
        : r.promoStart ?? addDaysToDateString(r.date, -(DEFAULT_PROMO_DAYS - 1)),
  }));
}

export const WEBINAR_SCHEDULE: Record<WebinarOffer, WebinarRun[]> = {
  bronson: chainPromos([
    // First campaign; promo started Oct 11 (user, 2026-10-19).
    { promoStart: "2026-10-11", date: "2026-10-18" },
    // "Not this Wednesday, the following one."
    { date: "2026-10-28" },
    // Third session, set in WebinarJam (schedule 4).
    { date: "2026-11-04" },
    // Fourth session: moved from Wed Nov 18 to Mon Nov 16, 7 PM ET (user, 2026-11-08; WebinarJam updated).
    { date: "2026-11-16" },
  ]),
  aval: chainPromos([
    { promoStart: "2026-10-14", date: "2026-10-18" },
    // Moved up from Sun Nov 15 to Sun Nov 8, 7 PM (user, 2026-11-02; WebinarJam updated).
    { date: "2026-11-08" },
    // Next session Sun Dec 6, 7 PM ET (user, 2026-11-08; WebinarJam schedule 4).
    { date: "2026-12-06" },
  ]),
};

/**
 * Seconds into the live session when the pitch starts. Retention until pitch
 * and stayed until pitch are read off the live room at this moment.
 * Bronson: pitch is around the 45 to 50 minute mark (user, 2026-11-04).
 * Aval: real pitch time not known yet (user, 2026-11-04), 1 hour until then.
 */
export const PITCH_AT_SECONDS: Record<WebinarOffer, number> = {
  bronson: 50 * 60,
  aval: 60 * 60,
};

/** False while the offer's pitch time above is a placeholder; the tab shows a reminder. */
export const PITCH_TIME_CONFIRMED: Record<WebinarOffer, boolean> = {
  bronson: true,
  aval: false,
};
