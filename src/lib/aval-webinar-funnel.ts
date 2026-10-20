import { unstable_cache } from "next/cache";
import type { BookingRow, MasterclassRegistrantRow } from "@/lib/airtable/tables";
import { getAvalConnectedCalls, getAvalMarketingDailyMetrics, getAvalPostCallNotes } from "@/lib/airtable/tables-aval";
import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { avalContactIds } from "@/lib/ghl-aval";
import { getWebinarJamRegistrants } from "@/lib/webinarjam";
import { webinarSourceRows, type WebinarSourceRow } from "@/lib/webinar-source-funnel";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

/** Aval's masterclass webinar in WebinarJam ("One Shift" system). */
const AVAL_WEBINAR_ID = "2";
/**
 * The Calendly event masterclass leads book, "Mind Over Market Gameplan Call
 * (Masterclass)" (user, 2026-10-19). Matched by its event type, not its name:
 * it was "Mind Over Market Gameplan Call" until 2026-10-19, and bookings keep
 * the name they were made under, while that old name now belongs to another
 * event (formerly "Path To Profits - Gameplan Call").
 */
const AVAL_MASTERCLASS_EVENT_TYPE = "https://api.calendly.com/event_types/b8ebda9b-293f-4790-b41c-0e189b770d7e";

type AvalInputs = { registrants: MasterclassRegistrantRow[]; bookings: BookingRow[] };

/**
 * Aval's webinar funnel inputs, read live from WebinarJam, Calendly and GHL
 * (no Zap or Airtable rows needed, user 2026-10-19). Paid = any of the
 * person's sign-ups carried an ad campaign UTM, the same rule the
 * registration Zap tags by. A booking takes the source of the registrant with
 * the same email; bookers who never registered are Unknown.
 */
const avalInputs = unstable_cache(
  async (today: string): Promise<AvalInputs> => {
    const apiKey = process.env.WEBINARJAM_AVAL_API_KEY;
    if (!apiKey) throw new Error("Missing WEBINARJAM_AVAL_API_KEY");
    const people = await getWebinarJamRegistrants(apiKey, AVAL_WEBINAR_ID, today);
    const paid = new Set(people.filter((p) => p.paidSignup).map((p) => p.email));
    const registered = new Set(people.map((p) => p.email));
    const sourceOf = (email: string) => (paid.has(email) ? "Paid" : registered.has(email) ? "Organic" : "Unknown");

    const registrants: MasterclassRegistrantRow[] = people.map((p) => ({
      id: p.key,
      sessionDate: p.sessionDate,
      source: sourceOf(p.email),
      stage: p.stage,
    }));

    const from = [...WEBINAR_SCHEDULE.aval].map((r) => r.promoStart).sort()[0];
    const made = await getBookingsMade({
      ...(await calendlyFor("aval")),
      isSalesCall: (_name, eventType) => eventType === AVAL_MASTERCLASS_EVENT_TYPE,
      from,
      to: today,
    });
    const ids = await avalContactIds(made.flatMap((b) => (b.inviteeEmail ? [b.inviteeEmail] : [])));
    const bookings: BookingRow[] = made.map((b) => {
      const email = (b.inviteeEmail ?? "").trim().toLowerCase();
      return {
        id: b.id,
        bookedDate: b.bookedDate,
        callTime: b.start,
        source: email ? sourceOf(email) : "Unknown",
        // Every contact id the person has, joined; matched against calls below.
        contactId: (ids[email] ?? []).join(",") || null,
        canceled: b.canceled,
        rescheduled: false,
        canceledBy: b.canceledBy === "host" ? "Host" : b.canceledBy ? "Invitee" : null,
        funnel: "Masterclass",
        email: email || null,
        name: b.inviteeName,
      };
    });
    return { registrants, bookings };
  },
  ["aval-webinar-funnel-inputs"],
  { revalidate: 900 },
);

/** Aval's masterclass Calendly bookings (reschedules counted once), with source. */
export async function avalBookings(today: string): Promise<BookingRow[]> {
  return (await avalInputs(today)).bookings;
}

/** Newest webinar first, paid vs organic, for Aval. */
export async function avalWebinarSourceRows(today: string): Promise<WebinarSourceRow[]> {
  const [{ registrants, bookings }, marketing, calls, notes] = await Promise.all([
    avalInputs(today),
    getAvalMarketingDailyMetrics(),
    getAvalConnectedCalls(),
    getAvalPostCallNotes(),
  ]);
  // A person can be two GHL contacts: point each booking at the one that has calls.
  const called = new Set(calls.flatMap((c) => (c.contactId ? [c.contactId] : [])));
  const matched = bookings.map((b) => {
    const all = (b.contactId ?? "").split(",").filter(Boolean);
    return { ...b, contactId: all.find((id) => called.has(id)) ?? all[0] ?? null };
  });
  return webinarSourceRows(WEBINAR_SCHEDULE.aval, marketing, registrants, matched, calls, notes, today);
}
