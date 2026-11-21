import type { BookingRow, ConnectedCallRow, MasterclassRegistrantRow } from "@/lib/airtable/tables";
import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { aaronContacts } from "@/lib/ghl-aaron";
import { staleWhileRevalidate } from "@/lib/swr-cache";

/**
 * Aaron (SetterHQ) runs no webinar: leads opt in to the free course, buy the
 * Base44 affiliate plan, then book a high ticket call. So there are no
 * webinar registrants, and bookings are his Calendly sales calls:
 * "Next Level - SalesHQ" (self-booked) and "SalesHQ Game Plan" (setter-booked).
 * Source comes from the booker's GHL tags, set on opt-in by the n8n workflow
 * ("base44 paid" / "base44 organic"); bookers with neither are Unknown.
 */
const BOOKINGS_FROM = "2026-11-01";

type AaronInputs = { registrants: MasterclassRegistrantRow[]; bookings: BookingRow[] };

async function loadAaronInputs(today: string): Promise<AaronInputs> {
  const made = await getBookingsMade({ ...(await calendlyFor("aaron")), from: BOOKINGS_FROM, to: today });
  const contacts = await aaronContacts(made.flatMap((b) => (b.inviteeEmail ? [b.inviteeEmail] : [])));
  const bookings: BookingRow[] = made.map((b) => {
    const email = (b.inviteeEmail ?? "").trim().toLowerCase();
    const c = email ? contacts[email] : undefined;
    return {
      id: b.id,
      bookedDate: b.bookedDate,
      callTime: b.start,
      source: c?.paid ? "Paid" : c?.organic ? "Organic" : "Unknown",
      contactId: (c?.ids ?? []).join(",") || null,
      canceled: b.canceled,
      rescheduled: false,
      canceledBy: b.canceledBy === "host" ? "Host" : b.canceledBy ? "Invitee" : null,
      funnel: "High Ticket",
      email: email || null,
      name: b.inviteeName,
    };
  });
  return { registrants: [], bookings };
}

/** Re-read in the background once 15 minutes old, so no visitor waits on Calendly and GHL. */
function aaronInputs(today: string): Promise<AaronInputs> {
  return staleWhileRevalidate("aaron-funnel-inputs:v1", () => loadAaronInputs(today), 900, 24 * 60 * 60);
}

/** Aaron's high ticket Calendly bookings (reschedules counted once), with source. */
export async function aaronBookings(today: string): Promise<BookingRow[]> {
  return (await aaronInputs(today)).bookings;
}

/** A person can be two GHL contacts: point each booking at the one that has calls. */
export function matchCalledContact(bookings: BookingRow[], calls: ConnectedCallRow[]): BookingRow[] {
  const called = new Set(calls.flatMap((c) => (c.contactId ? [c.contactId] : [])));
  return bookings.map((b) => {
    const all = (b.contactId ?? "").split(",").filter(Boolean);
    return { ...b, contactId: all.find((id) => called.has(id)) ?? all[0] ?? null };
  });
}

/** Registrants (none) and bookings (with source) for the Aaron scorecard. */
export async function aaronScorecardInputs(today: string): Promise<AaronInputs> {
  return aaronInputs(today);
}
