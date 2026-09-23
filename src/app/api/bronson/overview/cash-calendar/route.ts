import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics, getLeads, getBronsonAffiliatePcn } from "@/lib/airtable/tables";
import { filterByMonth, getAdSpendByDay, getCashByDay, monthTotal } from "@/lib/cash-calendar";
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

  // Cash Collected comes exclusively from the Marketing Daily Metrics form,
  // per the client — no layering in EOD Closer's own cash figure.
  const byDay = filterByMonth(getCashByDay(marketing), month);
  const adSpendByDay = filterByMonth(getAdSpendByDay(marketing), month);

  // Post Call Note has no lead-email field on this offer, so only Affiliate
  // PCN closes can be matched to a lead for the Paid/Organic split.
  const bySourceDay = cashBySourceByDay(leads, pcn);
  const bySourceForMonth: typeof bySourceDay = {};
  for (const [date, value] of Object.entries(bySourceDay)) {
    if (date.startsWith(month)) bySourceForMonth[date] = value;
  }

  return Response.json({
    byDay,
    total: monthTotal(byDay),
    bySourceDay: bySourceForMonth,
    adSpendByDay,
  });
}
