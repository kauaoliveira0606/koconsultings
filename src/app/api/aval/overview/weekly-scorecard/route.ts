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
import { AVAL_SCORECARD_LAYOUT, buildWeeklyScorecard, isoAddDays, sundayOf } from "@/lib/weekly-scorecard";
import { avalAffiliateBuyersBooked } from "@/lib/aval-ht-booked-from-affiliate";
import { avalBookings } from "@/lib/aval-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { getAvalGoals } from "@/lib/goals-aval";
import { CONNECTION_TRACKING_START } from "../connection-rate/route";
import { BRANDS, DATA_FLOOR } from "../attribution/route";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals, pcn, connected, portal, bookings] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
    getAvalAffiliatePcn(),
    getAvalConnectedCalls(),
    getAvalAffiliatePortalDaily(),
    // Paid masterclass bookings, for Cost Per Call (paid only). Blank if Calendly can't be read.
    avalBookings(easternDateString()).catch((err) => {
      console.error("Aval bookings", err);
      return undefined;
    }),
  ]);
  const start = sundayOf(weekStart ?? easternDateString());
  // HT Booking Rate (from Affiliate): blank, not wrong, if Calendly can't be read.
  const affiliateBuyers = await avalAffiliateBuyersBooked(pcn, start, isoAddDays(start, 6)).catch((err) => {
    console.error("Aval affiliate buyers booked", err);
    return undefined;
  });
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals, {
    layout: AVAL_SCORECARD_LAYOUT,
    pcn,
    connected,
    connectionTrackingStart: CONNECTION_TRACKING_START,
    bookings,
    affiliateBuyers,
    attribution: { portal, pcn, brands: BRANDS, dataFloor: DATA_FLOOR },
  });
  return Response.json(payload);
}
