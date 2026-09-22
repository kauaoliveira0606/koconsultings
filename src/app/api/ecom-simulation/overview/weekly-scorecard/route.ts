import type { NextRequest } from "next/server";
import {
  getAffiliateEod,
  getEodCloser,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables-ecom-simulation";
import type { BronsonAffiliateEodRow } from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getEcomSimulationGoals } from "@/lib/goals-ecom-simulation";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eodRaw, closer, goals] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getAffiliateEod(),
    getEodCloser(),
    getEcomSimulationGoals(),
  ]);

  // Reshape into the shared row shape (Bronson/Aval's own getters already
  // return this) so buildWeeklyScorecard works the same for every offer —
  // only the low-ticket cash field is named differently on this table.
  const eod: BronsonAffiliateEodRow[] = eodRaw.map((r) => ({
    id: r.id,
    date: r.date,
    repName: r.repName,
    outboundDials: r.outboundDials,
    pickups: r.pickups,
    softwarePitched: r.softwarePitched,
    softwareClosed: r.softwareClosed,
    highTicketCallsPitched: r.highTicketCallsPitched,
    newHighTicketCallsBooked: r.newHighTicketCallsBooked,
    highTicketCallsOnCalendar: r.highTicketCallsOnCalendar,
    highTicketCallsShowed: r.highTicketCallsShowed,
    highTicketSetClosed: r.highTicketSetClosed,
    cashCollectedAffiliate: r.cashCollectedLowTicket,
    cashCollectedHighTicket: r.cashCollectedHighTicket,
    totalTalkTimeRaw: r.totalTalkTimeRaw,
  }));

  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals);
  return Response.json(payload);
}
