import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { webinarTotals } from "@/lib/metrics";

export const revalidate = 60;

/** Webinar tab: the funnel totals for the selected range, from the form only. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const marketing = await getMarketingDailyMetrics();
  return Response.json(webinarTotals(marketing.filter((r) => isDateInRange(r.date, range))));
}
