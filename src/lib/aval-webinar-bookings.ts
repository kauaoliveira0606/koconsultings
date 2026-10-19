import { unstable_cache } from "next/cache";
import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { addDaysToDateString } from "@/lib/date-range";
import { avalMasterclassEmails } from "@/lib/ghl-aval";
import type { WebinarRun } from "@/lib/webinar-schedule";

/**
 * Real calls booked off one Aval webinar (user, 2026-10-19), not the form's
 * at pitch × booking rate estimate: Calendly sales calls made from the webinar
 * day until the day before the next one (or today), by people tagged
 * masterclass in GHL. Canceled calls count as booked, like Bronson's;
 * reschedules count once.
 */
const bookedBetween = unstable_cache(
  async (from: string, to: string) => {
    const bookings = await getBookingsMade({ ...(await calendlyFor("aval")), from, to });
    const masterclass = await avalMasterclassEmails(bookings.flatMap((b) => (b.inviteeEmail ? [b.inviteeEmail] : [])));
    return bookings.filter((b) => b.inviteeEmail && masterclass.has(b.inviteeEmail.trim().toLowerCase())).length;
  },
  ["aval-webinar-bookings"],
  { revalidate: 300 },
);

/**
 * Calls booked per webinar held by today, keyed by webinar date. Null when
 * Calendly or GHL can't be read: the card shows blank, never the estimate.
 */
export async function avalWebinarBookings(runs: WebinarRun[], today: string): Promise<Map<string, number | null>> {
  const dates = runs.map((r) => r.date).sort();
  const held = dates.filter((d) => d <= today);
  const counts = await Promise.all(
    held.map((d) => {
      const next = dates.find((n) => n > d);
      return bookedBetween(d, next && next <= today ? addDaysToDateString(next, -1) : today).catch((err) => {
        console.error("Aval webinar bookings", err);
        return null;
      });
    }),
  );
  return new Map(held.map((d, i) => [d, counts[i]]));
}
