import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { webinarTotals } from "@/lib/metrics";
import { webinarStartDate } from "@/lib/webinar-breakdown";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const marketing = await getMarketingDailyMetrics();
  // Only days since the webinar funnel started, so ad spend from the funnels
  // that ran before it doesn't land on the webinar's cost per lead / call.
  const start = webinarStartDate(marketing);
  const days = marketing.filter((r) => isDateInRange(r.date, range) && !!start && !!r.date && r.date >= start);
  return Response.json({ ...webinarTotals(days), startDate: start });
}
