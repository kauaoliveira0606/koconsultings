/**
 * HT Booking Rate (from Affiliate), Aval: of the affiliate buyers, how many
 * booked a high ticket call (client definition, 2026-10-25).
 *
 * Buyers are the Affiliate Post Call Notes (one per lead email, on the day of
 * their first note). A buyer counts as booked when that email has a sales
 * call on Calendly or on the GHL calendar, booked on or after the purchase
 * day. Canceled bookings still count as booked.
 */

import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";
import { staleWhileRevalidate } from "@/lib/swr-cache";

const GHL_API = "https://services.leadconnectorhq.com";

export type AffiliateBuyer = { date: string; booked: boolean };

type HtBooking = { email: string; bookedDate: string };

async function ghlGet<T>(pat: string, path: string, version: string): Promise<T> {
  const res = await fetch(`${GHL_API}${path}`, {
    headers: { Authorization: `Bearer ${pat}`, Version: version },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GHL request failed (${res.status}) for ${path.split("?")[0]}`);
  return res.json() as Promise<T>;
}

/** GHL calendar appointments added from..today, with the lead's email. */
async function ghlBookings(from: string): Promise<HtBooking[]> {
  const pat = process.env.GHL_AVAL_PIT;
  const locationId = process.env.GHL_AVAL_LOCATION_ID;
  if (!pat || !locationId) throw new Error("Missing GHL_AVAL_PIT or GHL_AVAL_LOCATION_ID");
  const start = new Date(`${from}T00:00:00Z`).getTime() - 6 * 60 * 60 * 1000;
  const end = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const { calendars } = await ghlGet<{ calendars: { id: string }[] }>(
    pat,
    `/calendars/?locationId=${locationId}`,
    "2021-04-15"
  );
  const events = (
    await Promise.all(
      calendars.map(async (cal) => {
        const { events } = await ghlGet<{
          events: { contactId?: string; dateAdded?: string; startTime: string; deleted?: boolean }[];
        }>(
          pat,
          `/calendars/events?${new URLSearchParams({
            locationId,
            calendarId: cal.id,
            startTime: String(start),
            endTime: String(end),
          })}`,
          "2021-04-15"
        );
        return events;
      })
    )
  )
    .flat()
    .filter((e) => !e.deleted && e.contactId);
  const contactIds = [...new Set(events.map((e) => e.contactId!))];
  const emailOf = new Map<string, string>();
  // A few at a time: GHL allows about 100 requests per 10 seconds.
  for (let i = 0; i < contactIds.length; i += 8) {
    await Promise.all(
      contactIds.slice(i, i + 8).map(async (id) => {
        const { contact } = await ghlGet<{ contact: { email?: string } }>(pat, `/contacts/${id}`, "2021-07-28").catch(
          () => ({ contact: {} as { email?: string } })
        );
        if (contact.email) emailOf.set(id, contact.email.trim().toLowerCase());
      })
    );
  }
  return events.flatMap((e) => {
    const email = emailOf.get(e.contactId!);
    const bookedDate = (e.dateAdded ?? e.startTime).slice(0, 10);
    return email ? [{ email, bookedDate }] : [];
  });
}

async function loadHtBookings(from: string): Promise<HtBooking[]> {
  const today = easternDateString();
  const [calendly, ghl] = await Promise.all([
    calendlyFor("aval").then(({ pat, organization, isSalesCall }) =>
      getBookingsMade({ pat, organization, isSalesCall: (name) => isSalesCall(name), from, to: today })
    ),
    ghlBookings(from).catch((err) => {
      console.error("Aval GHL bookings", err);
      return [] as HtBooking[];
    }),
  ]);
  return [
    ...calendly.flatMap((b) =>
      b.inviteeEmail ? [{ email: b.inviteeEmail.trim().toLowerCase(), bookedDate: b.bookedDate }] : []
    ),
    ...ghl,
  ];
}

/** Every Aval HT booking made from..today. Re-read in the background once 15 minutes old. */
function htBookings(from: string): Promise<HtBooking[]> {
  return staleWhileRevalidate(`aval-ht-bookings:v1:${from}`, () => loadHtBookings(from), 900, 24 * 60 * 60);
}

/** Affiliate buyers whose first Post Call Note falls on from..to, each marked booked or not. */
export async function avalAffiliateBuyersBooked(
  pcn: { date: string | null; leadEmail: string | null }[],
  from: string,
  to: string
): Promise<AffiliateBuyer[]> {
  // First note per email; notes without an email are each their own buyer.
  const firstDate = new Map<string, string>();
  const noEmail: string[] = [];
  for (const r of pcn) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    const email = (r.leadEmail ?? "").trim().toLowerCase();
    if (!email) {
      noEmail.push(d);
      continue;
    }
    const seen = firstDate.get(email);
    if (!seen || d < seen) firstDate.set(email, d);
  }
  const buyers = [...firstDate].filter(([, d]) => d >= from && d <= to);
  if (buyers.length === 0 && noEmail.length === 0) return [];

  const bookedOn = new Map<string, string[]>();
  for (const b of await htBookings(from)) {
    bookedOn.set(b.email, [...(bookedOn.get(b.email) ?? []), b.bookedDate]);
  }
  return [
    ...buyers.map(([email, date]) => ({
      date,
      booked: (bookedOn.get(email) ?? []).some((d) => d >= date),
    })),
    ...noEmail.filter((d) => d >= from && d <= to).map((date) => ({ date, booked: false })),
  ];
}
