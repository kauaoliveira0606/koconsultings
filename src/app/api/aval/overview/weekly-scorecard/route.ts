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
import { AVAL_SCORECARD_LAYOUT, buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { avalScorecardInputs, matchCalledContact } from "@/lib/aval-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { getAvalGoals } from "@/lib/goals-aval";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";
import { BRANDS, DATA_FLOOR } from "../attribution/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, portal, webinar] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
    getAvalAffiliatePcn(),
    getAvalConnectedCalls(),
    getAvalAffiliatePortalDaily(),
    // Masterclass Calendly bookings and WebinarJam registrants by source, for Cost Per
    // Call and the paid / organic booking and show rows. Blank if they can't be read.
    avalScorecardInputs(easternDateString()).catch((err) => {
      console.error("Aval bookings", err);
      return undefined;
    }),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    layout: AVAL_SCORECARD_LAYOUT,
    optInRateOnPlays: true,
    pcn,
    connected,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    bookings: webinar && matchCalledContact(webinar.bookings, connected),
    registrants: webinar?.registrants,
    attribution: { portal, pcn, brands: BRANDS, dataFloor: DATA_FLOOR },
  });
  return Response.json(payload);
}
