import type { NextRequest } from "next/server";
import {
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
  getAvalLeads,
  getAvalMarketingDailyMetrics,
} from "@/lib/airtable/tables-aval";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads, eod, closer] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
  ]);
  const payload = await buildWeeklyScorecard(marketing, leads, eod, closer, weekStart);
  return Response.json(payload);
}
