import type { NextRequest } from "next/server";
import {
  getBronsonAffiliateEod,
  getBronsonAffiliatePcn,
  getBookings,
  getBronsonEodCloser,
  getConnectedCalls,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { BRONSON_SCORECARD_LAYOUT, buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getGoals } from "@/lib/goals";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, bookings] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
    getBronsonAffiliatePcn(),
    getConnectedCalls(),
    getBookings(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    pcn,
    connected,
    bookings,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    layout: BRONSON_SCORECARD_LAYOUT,
  });
  return Response.json(payload);
}
