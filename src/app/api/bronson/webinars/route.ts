import type { NextRequest } from "next/server";
import {
  getBookings,
  getBronsonAffiliateEod,
  getConnectedCalls,
  getMarketingDailyMetrics,
  getMasterclassRegistrants,
} from "@/lib/airtable/tables";
import { webinarSourceRows } from "@/lib/webinar-source-funnel";
import { parseRangeFromRequest } from "@/lib/api-range";
import { easternDateString, isDateInRange } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, eod, registrants, bookings, calls] = await Promise.all([
    getMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    getMasterclassRegistrants(),
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

  // Calls booked = the real Calendly masterclass bookings of the webinars held in
  // range (user, 2026-10-19), not the form's at pitch × booking rate estimate.
  const totals = webinarTotals(days);
  const held = webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, easternDateString()).filter(
    (w) => w.status === "done" && isDateInRange(w.date, range),
  );
  const callsBooked = held.length ? held.reduce((n, w) => n + w.total.booked, 0) : totals.callsBooked;
  const spending = (totals.adSpend ?? 0) > 0;

  return Response.json({
    ...totals,
    callsBooked,
    costPerBookedCall: held.length ? (spending ? safeDivide(totals.adSpend, callsBooked || null) : null) : totals.costPerBookedCall,
    callsBookedFrom: held.length ? "calendly" : "form",
    startDate: start,
    connection: { reachOut, connected, rate: safeDivide(connected, reachOut || null) },
  });
}
