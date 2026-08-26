import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { filterByMonth, getCashByDay, monthTotal } from "@/lib/cash-calendar";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const marketing = await getMarketingDailyMetrics();
  const byDay = filterByMonth(getCashByDay(marketing), month);

  return Response.json({ byDay, total: monthTotal(byDay) });
}
