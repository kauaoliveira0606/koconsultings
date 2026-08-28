import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics, getLeads, getBronsonAffiliatePcn } from "@/lib/airtable/tables";
import { filterByMonth, getCashByDay, monthTotal } from "@/lib/cash-calendar";
import { cashBySourceByDay } from "@/lib/airtable/lead-source-lookup";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const [marketing, leads, pcn] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliatePcn(),
  ]);

  const byDay = filterByMonth(getCashByDay(marketing), month);

  const bySourceDay = cashBySourceByDay(leads, pcn);
  const bySourceForMonth: typeof bySourceDay = {};
  for (const [date, value] of Object.entries(bySourceDay)) {
    if (date.startsWith(month)) bySourceForMonth[date] = value;
  }

  return Response.json({ byDay, total: monthTotal(byDay), bySourceDay: bySourceForMonth });
}
