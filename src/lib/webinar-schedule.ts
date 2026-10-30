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
  ]),
  aval: chainPromos([
    { promoStart: "2026-10-14", date: "2026-10-18" },
    // WebinarJam's next session is Sun Nov 15, 7 PM (user, 2026-10-30; Nov 1 was only a placeholder).
    { date: "2026-11-15" },
  ]),
};
