import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { easternDateString } from "@/lib/date-range";

export const dynamic = "force-dynamic";

/** Temporary check (admin only): Aval Calendly event names booked since the webinar promo, with counts. */
export async function GET() {
  const counts = new Map<string, number>();
  const cal = await calendlyFor("aval");
  await getBookingsMade({
    ...cal,
    isSalesCall: (name) => {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return false;
    },
    from: "2026-10-14",
    to: easternDateString(),
  });
  return Response.json({ eventNames: Object.fromEntries(counts) });
}
