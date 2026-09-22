import type { NextRequest } from "next/server";
import {
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
  getAvalLeads,
  getAvalMarketingDailyMetrics,
} from "@/lib/airtable/tables-aval";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getAvalGoals } from "@/lib/goals-aval";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals);
  return Response.json(payload);
}
