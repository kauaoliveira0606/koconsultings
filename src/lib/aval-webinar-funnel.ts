import type { BookingRow, ConnectedCallRow, MasterclassRegistrantRow } from "@/lib/airtable/tables";
import { getAvalConnectedCalls, getAvalMarketingDailyMetrics, getAvalPostCallNotes } from "@/lib/airtable/tables-aval";
import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { avalContacts } from "@/lib/ghl-aval";
import { getWebinarJamRegistrants } from "@/lib/webinarjam";
import { webinarSourceRows, type WebinarSourceRow } from "@/lib/webinar-source-funnel";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";
import { staleWhileRevalidate } from "@/lib/swr-cache";

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
 * the same email, or of the booker's GHL `paid` / `organic` tag (opt-ins like
 * /base44 carry these, user 2026-10-27); paid on either side wins, and bookers
 * with neither are Unknown.
 */
async function loadAvalInputs(today: string): Promise<AvalInputs> {
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
  const contacts = await avalContacts(made.flatMap((b) => (b.inviteeEmail ? [b.inviteeEmail] : [])));
  const bookingSource = (email: string) => {
    const fromWebinar = sourceOf(email);
    if (fromWebinar === "Paid" || contacts[email]?.paid) return "Paid";
    if (fromWebinar === "Organic" || contacts[email]?.organic) return "Organic";
    return "Unknown";
  };
  const bookings: BookingRow[] = made.map((b) => {
    const email = (b.inviteeEmail ?? "").trim().toLowerCase();
    return {
      id: b.id,
      bookedDate: b.bookedDate,
      callTime: b.start,
      source: email ? bookingSource(email) : "Unknown",
      // Every contact id the person has, joined; matched against calls below.
      contactId: (contacts[email]?.ids ?? []).join(",") || null,
      canceled: b.canceled,
      rescheduled: false,
      canceledBy: b.canceledBy === "host" ? "Host" : b.canceledBy ? "Invitee" : null,
      funnel: "Masterclass",
      email: email || null,
      name: b.inviteeName,
    };
  });
  return { registrants, bookings };
}

/** Re-read in the background once 15 minutes old, so no visitor waits on WebinarJam, Calendly and GHL. */
function avalInputs(today: string): Promise<AvalInputs> {
  return staleWhileRevalidate("aval-webinar-funnel-inputs:v2", () => loadAvalInputs(today), 900, 24 * 60 * 60);
}

/** Aval's masterclass Calendly bookings (reschedules counted once), with source. */
export async function avalBookings(today: string): Promise<BookingRow[]> {
  return (await avalInputs(today)).bookings;
}

/** A person can be two GHL contacts: point each booking at the one that has calls. */
export function matchCalledContact(bookings: BookingRow[], calls: ConnectedCallRow[]): BookingRow[] {
  const called = new Set(calls.flatMap((c) => (c.contactId ? [c.contactId] : [])));
  return bookings.map((b) => {
    const all = (b.contactId ?? "").split(",").filter(Boolean);
    return { ...b, contactId: all.find((id) => called.has(id)) ?? all[0] ?? null };
  });
}

/** Registrants and bookings (with source) for the Aval scorecard. */
export async function avalScorecardInputs(today: string): Promise<AvalInputs> {
  return avalInputs(today);
}

/** Newest webinar first, paid vs organic, for Aval. */
export async function avalWebinarSourceRows(today: string): Promise<WebinarSourceRow[]> {
  const [{ registrants, bookings }, marketing, calls, notes] = await Promise.all([
    avalInputs(today),
    getAvalMarketingDailyMetrics(),
    getAvalConnectedCalls(),
    getAvalPostCallNotes(),
  ]);
  const matched = matchCalledContact(bookings, calls);
  return webinarSourceRows(WEBINAR_SCHEDULE.aval, marketing, registrants, matched, calls, notes, today);
}
