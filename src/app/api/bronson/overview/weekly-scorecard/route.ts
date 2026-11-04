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
import { bronsonRegistrants } from "@/lib/bronson-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, bookings, registrants] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
    getBronsonAffiliatePcn(),
    getConnectedCalls(),
    getBookings(),
    bronsonRegistrants(easternDateString()),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    pcn,
    connected,
    bookings,
    registrants,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    layout: BRONSON_SCORECARD_LAYOUT,
  });
  return Response.json(payload);
}
