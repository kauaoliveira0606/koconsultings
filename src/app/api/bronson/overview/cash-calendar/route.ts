import type { NextRequest } from "next/server";
import {
  getMarketingDailyMetrics,
  getLeads,
  getBronsonAffiliatePcn,
  getBronsonEodCloser,
} from "@/lib/airtable/tables";
import { filterByMonth, getCashByDay, monthTotal } from "@/lib/cash-calendar";
import { cashBySourceByDay } from "@/lib/airtable/lead-source-lookup";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const [marketing, leads, pcn, eodCloser] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliatePcn(),
    getBronsonEodCloser(),
  ]);

  const byDay = filterByMonth(getCashByDay(marketing), month);

  // The High Ticket Closer's cash doesn't always come through the Marketing
  // Daily Metrics form, so layer EOD Closer's real cash on top for any day
  // it has one — same preferred-source idea as the metrics route.
  for (const row of eodCloser) {
    if (!row.date || !row.date.startsWith(month) || !row.cashCollectedHighTicket) continue;
    byDay[row.date] = (byDay[row.date] ?? 0) + row.cashCollectedHighTicket;
  }

  // Post Call Note has no lead-email field on this offer, so only Affiliate
  // PCN closes can be matched to a lead for the Paid/Organic split.
  const bySourceDay = cashBySourceByDay(leads, pcn);
  const bySourceForMonth: typeof bySourceDay = {};
  for (const [date, value] of Object.entries(bySourceDay)) {
    if (date.startsWith(month)) bySourceForMonth[date] = value;
  }

  return Response.json({ byDay, total: monthTotal(byDay), bySourceDay: bySourceForMonth });
}
