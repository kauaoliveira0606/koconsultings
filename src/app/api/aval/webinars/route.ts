import type { NextRequest } from "next/server";
import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { parseRangeFromRequest } from "@/lib/api-range";
import { avalWebinarSourceRows } from "@/lib/aval-webinar-funnel";
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

  // Calls booked = the real Calendly masterclass bookings of the webinars held in
  // range (same numbers as the paid vs organic funnel). Blank if Calendly,
  // WebinarJam or GHL can't be read, never the estimate.
  const funnel = await avalWebinarSourceRows(easternDateString()).catch((err) => {
    console.error("Aval webinar funnel", err);
    return null;
  });
  const held = (funnel ?? []).filter((w) => w.status === "done" && isDateInRange(w.date, range));
  if (funnel && !held.length) return Response.json({ ...totals, callsBookedFrom: "form", startDate: start });
  const callsBooked = funnel ? held.reduce((n, w) => n + w.total.booked, 0) : null;
  // Ad spend only buys paid calls (user, 2026-10-19): cost per booked call is over paid bookings.
  const paidBooked = funnel ? held.reduce((n, w) => n + w.paid.booked, 0) : null;
  return Response.json({
    ...totals,
    callsBooked,
    costPerBookedCall: (totals.adSpend ?? 0) > 0 ? safeDivide(totals.adSpend, paidBooked || null) : null,
    callsBookedFrom: "calendly",
    startDate: start,
  });
}
