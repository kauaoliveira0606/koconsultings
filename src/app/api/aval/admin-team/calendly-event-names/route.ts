import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { easternDateString } from "@/lib/date-range";

export const dynamic = "force-dynamic";

/** Temporary check (admin only): Aval Calendly event types booked since the webinar promo, their names now and then. */
export async function GET() {
  const cal = await calendlyFor("aval");
  const made = await getBookingsMade({ ...cal, isSalesCall: () => true, from: "2026-10-14", to: easternDateString() });
  const out: Record<string, { bookings: number; namesAtBooking: string[]; nameNow: string | null }> = {};
  for (const b of made) {
    const row = (out[b.eventType] ??= { bookings: 0, namesAtBooking: [], nameNow: null });
    row.bookings += 1;
    if (!row.namesAtBooking.includes(b.eventName)) row.namesAtBooking.push(b.eventName);
  }
  for (const uri of Object.keys(out)) {
    const res = await fetch(uri, { headers: { Authorization: `Bearer ${cal.pat}` }, cache: "no-store" });
    out[uri].nameNow = res.ok ? ((await res.json()) as { resource: { name: string } }).resource.name : null;
  }
  return Response.json(out);
}
