import type { NextRequest } from "next/server";
import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { parseRangeFromRequest } from "@/lib/api-range";
import { avalWebinarBookings } from "@/lib/aval-webinar-bookings";
import { easternDateString, isDateInRange } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range from the form; calls booked from Calendly. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const marketing = await getAvalMarketingDailyMetrics();
  // Only promo days and webinar days of the webinars run, so ad spend from
  // older funnels and break days doesn't land on cost per lead / call.
  const start = webinarStartDate(marketing, WEBINAR_SCHEDULE.aval);
  const days = webinarRows(marketing, WEBINAR_SCHEDULE.aval).filter((r) => isDateInRange(r.date, range));
  const totals = webinarTotals(days);

  // Calls booked = the real Calendly masterclass bookings of the webinars held in range.
  const held = [...(await avalWebinarBookings(WEBINAR_SCHEDULE.aval, easternDateString())).entries()].filter(([d]) =>
    isDateInRange(d, range),
  );
  if (!held.length) return Response.json({ ...totals, callsBookedFrom: "form", startDate: start });
  const callsBooked = held.reduce((n, [, c]) => n + c, 0);
  return Response.json({
    ...totals,
    callsBooked,
    costPerBookedCall: (totals.adSpend ?? 0) > 0 ? safeDivide(totals.adSpend, callsBooked || null) : null,
    callsBookedFrom: "calendly",
    startDate: start,
  });
}
