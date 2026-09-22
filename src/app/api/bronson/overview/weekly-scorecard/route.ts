import type { NextRequest } from "next/server";
import {
  getBronsonAffiliateEod,
  getBronsonEodCloser,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";
import { getGoals } from "@/lib/goals";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer, goals] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart, new Date(), goals);
  return Response.json(payload);
}
