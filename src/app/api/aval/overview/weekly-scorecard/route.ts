import type { NextRequest } from "next/server";
import {
  getAvalAffiliateEod,
  getAvalAffiliatePcn,
  getAvalAffiliatePortalDaily,
  getAvalConnectedCalls,
  getAvalEodCloserScorecard,
  getAvalLeads,
  getAvalMarketingDailyMetrics,
} from "@/lib/airtable/tables-aval";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getAvalGoals } from "@/lib/goals-aval";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";
import { BRANDS, DATA_FLOOR } from "../attribution/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, portal] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
    getAvalAffiliatePcn(),
    getAvalConnectedCalls(),
    getAvalAffiliatePortalDaily(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    pcn,
    connected,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    attribution: { portal, pcn, brands: BRANDS, dataFloor: DATA_FLOOR },
  });
  return Response.json(payload);
}
