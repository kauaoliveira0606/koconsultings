import type { NextRequest } from "next/server";
import {
  getAffiliatePortalDaily,
  getBronsonAffiliateEod,
  getBronsonAffiliatePcn,
  getBronsonEodCloser,
  getConnectedCalls,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getGoals } from "@/lib/goals";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";
import { BRANDS, FROM } from "../attribution/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, portal] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
    getBronsonAffiliatePcn(),
    getConnectedCalls(),
    getAffiliatePortalDaily(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    pcn,
    connected,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    attribution: { portal, pcn, brands: BRANDS, dataFloor: FROM },
  });
  return Response.json(payload);
}
