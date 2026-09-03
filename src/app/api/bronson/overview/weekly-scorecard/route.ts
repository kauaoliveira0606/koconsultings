import type { NextRequest } from "next/server";
import {
  getBronsonAffiliateEod,
  getBronsonEodCloser,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart);
  return Response.json(payload);
}
