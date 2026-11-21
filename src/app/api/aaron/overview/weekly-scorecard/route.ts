import type { NextRequest } from "next/server";
import {
  getAaronAffiliateEod,
  getAaronAffiliatePcn,
  getAaronAffiliatePortalDaily,
  getAaronConnectedCalls,
  getAaronEodCloserScorecard,
  getAaronLeads,
  getAaronMarketingDailyMetrics,
} from "@/lib/airtable/tables-aaron";
import { AARON_SCORECARD_LAYOUT, buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { aaronScorecardInputs, matchCalledContact } from "@/lib/aaron-funnel";
import { easternDateString } from "@/lib/date-range";
import { getAaronGoals } from "@/lib/goals-aaron";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";
import { BRANDS, DATA_FLOOR } from "../attribution/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, portal, webinar] = await Promise.all([
    getAaronMarketingDailyMetrics(),
    getAaronLeads(),
    getAaronAffiliateEod(),
    getAaronEodCloserScorecard(),
    getAaronGoals(),
    getAaronAffiliatePcn(),
    getAaronConnectedCalls(),
    getAaronAffiliatePortalDaily(),
    // Masterclass Calendly bookings and WebinarJam registrants by source, for Cost Per
    // Call and the paid / organic booking and show rows. Blank if they can't be read.
    aaronScorecardInputs(easternDateString()).catch((err) => {
      console.error("Aaron bookings", err);
      return undefined;
    }),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    layout: AARON_SCORECARD_LAYOUT,
    pcn,
    connected,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    bookings: webinar && matchCalledContact(webinar.bookings, connected),
    registrants: webinar?.registrants,
    attribution: { portal, pcn, brands: BRANDS, dataFloor: DATA_FLOOR },
  });
  return Response.json(payload);
}
