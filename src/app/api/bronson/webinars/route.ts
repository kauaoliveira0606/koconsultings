import type { NextRequest } from "next/server";
import { getBookings, getBronsonAffiliateEod, getConnectedCalls, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { BOOKINGS_TRACKING_START, bookingStats } from "@/lib/booking-source";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, eod, bookings, calls] = await Promise.all([
    getMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    getBookings(),
    getConnectedCalls(),
  ]);
  // Only promo days and webinar days of the webinars run, so ad spend from
  // older funnels and break days doesn't land on cost per lead / call.
  const start = webinarStartDate(marketing, WEBINAR_SCHEDULE.bronson);
  const days = webinarRows(marketing, WEBINAR_SCHEDULE.bronson).filter((r) => isDateInRange(r.date, range));

  // Call connection rate (user, 2026-10-19): self-booked leads connected ÷
  // self-booked calls to reach out to, summed over the setters' Affiliate EODs.
  let reachOut = 0;
  let connected = 0;
  for (const r of eod) {
    if (!r.date || !isDateInRange(r.date, range)) continue;
    reachOut += r.selfBookedToReachOut ?? 0;
    connected += r.selfBookedConnected ?? 0;
  }

  // Paid / organic booking + connection rates, automatic (user, 2026-10-19):
  // Calendly bookings carry the lead's masterclass tag; connected = a 1+ min
  // GHL call between booking and the call. Counted from the Bookings table start.
  const tracked = (d: string) => d >= BOOKINGS_TRACKING_START && isDateInRange(d, range);
  const stats = bookingStats(bookings, calls, tracked);
  let optInsPaid = 0;
  let optInsOrganic = 0;
  for (const r of days) {
    if (!r.date || !tracked(r.date)) continue;
    optInsPaid += r.webinarOptInsPaid ?? 0;
    optInsOrganic += r.webinarOptInsOrganic ?? 0;
  }
  const bySource = (s: (typeof stats)["Paid"], optIns: number) => ({
    ...s,
    optIns,
    bookingRate: safeDivide(s.booked, optIns || null),
    connectionRate: safeDivide(s.connected, s.connectable || null),
  });

  return Response.json({
    ...webinarTotals(days),
    startDate: start,
    connection: { reachOut, connected, rate: safeDivide(connected, reachOut || null) },
    bookings: {
      trackingStart: BOOKINGS_TRACKING_START,
      paid: bySource(stats.Paid, optInsPaid),
      organic: bySource(stats.Organic, optInsOrganic),
    },
  });
}
