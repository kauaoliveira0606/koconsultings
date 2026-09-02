import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");
  const marketing = await getMarketingDailyMetrics();
  const payload = await buildWeeklyScorecard(marketing, weekStart);
  return Response.json(payload);
}
