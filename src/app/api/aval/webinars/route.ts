import type { NextRequest } from "next/server";
import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { webinarTotals } from "@/lib/metrics";
import { webinarRows, webinarStartDate } from "@/lib/webinar-breakdown";
import { WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const marketing = await getAvalMarketingDailyMetrics();
  // Only promo days and webinar days of the webinars run, so ad spend from
  // older funnels and break days doesn't land on cost per lead / call.
  const start = webinarStartDate(marketing, WEBINAR_SCHEDULE.aval);
  const days = webinarRows(marketing, WEBINAR_SCHEDULE.aval).filter((r) => isDateInRange(r.date, range));
  return Response.json({ ...webinarTotals(days), startDate: start });
}
