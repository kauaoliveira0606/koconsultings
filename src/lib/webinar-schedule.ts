/**
 * The webinars each offer has run or planned (user, 2026-10-19). Each one is a
 * promo period that ends on the webinar day; the days between webinars are a
 * break and don't count toward any webinar. Add the next one here once its
 * date is set.
 */
export type WebinarRun = { promoStart: string; date: string };

export type WebinarOffer = "bronson" | "aval";

export const WEBINAR_SCHEDULE: Record<WebinarOffer, WebinarRun[]> = {
  bronson: [
    // First campaign; promo started Oct 11 (user, 2026-10-19).
    { promoStart: "2026-10-11", date: "2026-10-18" },
    // "Not this Wednesday, the following one." Promo length assumed 5 days like the first.
    { promoStart: "2026-10-24", date: "2026-10-28" },
  ],
  aval: [
    { promoStart: "2026-10-14", date: "2026-10-18" },
    // Next one after a 2-week break: WebinarJam's next session is Sun Nov 1, 7 PM
    // (seen 2026-10-19). Promo length assumed 5 days like the first.
    { promoStart: "2026-10-28", date: "2026-11-01" },
  ],
};

/** Promo length used for a post-webinar card whose date isn't on the schedule. */
export const DEFAULT_PROMO_DAYS = 5;
