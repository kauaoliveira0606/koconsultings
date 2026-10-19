import type { NextRequest } from "next/server";
import {
  getBronsonAffiliateEod,
  getBronsonAffiliatePcn,
  getBronsonEodCloser,
  getConnectedCalls,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { BRONSON_SCORECARD_LAYOUT, buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getGoals } from "@/lib/goals";
import { MASTERCLASS_CONNECTION_START } from "../../webinars/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
    getBronsonAffiliatePcn(),
    getConnectedCalls(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    pcn,
    connected,
    // Bronson's calls are tagged by masterclass paid / organic since this date.
    connectionTrackingStart: MASTERCLASS_CONNECTION_START,
    layout: BRONSON_SCORECARD_LAYOUT,
  });
  return Response.json(payload);
}
