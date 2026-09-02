import type { NextRequest } from "next/server";
import { getLeads, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const [marketing, leads] = await Promise.all([getMarketingDailyMetrics(), getLeads()]);
  const payload = await buildWeeklyScorecard(marketing, leads, weekStart);
  return Response.json(payload);
}
