import type { NextRequest } from "next/server";
import { getBronsonAffiliateEod, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { safeDivide, webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, eod] = await Promise.all([getMarketingDailyMetrics(), getBronsonAffiliateEod()]);
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

  return Response.json({
    ...webinarTotals(days),
    startDate: start,
    connection: { reachOut, connected, rate: safeDivide(connected, reachOut || null) },
  });
}
