import type { BookingRow, ConnectedCallRow } from "@/lib/airtable/tables";
import { toEasternDateOnly } from "@/lib/date-range";

/** First day the Bookings table has rows (backfilled from Calendly). */
export const BOOKINGS_TRACKING_START = "2026-10-08";

export type BookingSource = "Paid" | "Organic";

/**
 * Bookings that count: a reschedule's cancelled original is dropped (its new
 * time is its own row), so one person rebooking is one booking.
 */
export function countedBookings(bookings: BookingRow[]): BookingRow[] {
  return bookings.filter((b) => !b.rescheduled && !!b.bookedDate);
}

/**
 * Connected = the booked lead had a 1+ minute call (Connected Calls table, any
 * source label) from the day they booked through the day of the call. Fully
 * automatic: GHL logs the calls, nobody types anything in.
 */
export function connectedBookingIds(bookings: BookingRow[], calls: ConnectedCallRow[]): Set<string> {
  const callDays = new Map<string, string[]>();
  for (const c of calls) {
    if (!c.contactId || !c.date) continue;
    const list = callDays.get(c.contactId) ?? [];
    list.push(c.date);
    callDays.set(c.contactId, list);
  }
  const out = new Set<string>();
  for (const b of bookings) {
    if (!b.contactId || !b.bookedDate) continue;
    const last = toEasternDateOnly(b.callTime) ?? b.bookedDate;
    if ((callDays.get(b.contactId) ?? []).some((d) => d >= b.bookedDate! && d <= last)) out.add(b.id);
  }
  return out;
}

export type SourceBookingStats = {
  /** Bookings made in the range (reschedules counted once). */
  booked: number;
  canceled: number;
  /** Non-canceled bookings whose lead got a 1+ min call before the call. */
  connected: number;
  /** Non-canceled bookings, the connection rate's denominator. */
  connectable: number;
};

export function bookingStats(
  bookings: BookingRow[],
  calls: ConnectedCallRow[],
  inRange: (date: string) => boolean,
): Record<BookingSource, SourceBookingStats> {
  const counted = countedBookings(bookings).filter((b) => inRange(b.bookedDate!));
  const connected = connectedBookingIds(counted, calls);
  const empty = (): SourceBookingStats => ({ booked: 0, canceled: 0, connected: 0, connectable: 0 });
  const out: Record<BookingSource, SourceBookingStats> = { Paid: empty(), Organic: empty() };
  for (const b of counted) {
    if (b.source !== "Paid" && b.source !== "Organic") continue;
    const s = out[b.source];
    s.booked += 1;
    if (b.canceled) s.canceled += 1;
    else {
      s.connectable += 1;
      if (connected.has(b.id)) s.connected += 1;
    }
  }
  return out;
}
