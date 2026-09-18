import type { NextRequest } from "next/server";
import {
  getAvalMarketingDailyMetrics,
  getAvalLeads,
  getAvalAffiliatePcn,
  getAvalPostCallNotes,
} from "@/lib/airtable/tables-aval";
import { filterByMonth, getCashByDay, monthTotal } from "@/lib/cash-calendar";
import { cashBySourceByDay } from "@/lib/airtable/lead-source-lookup";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const [marketing, leads, pcn, postCallNotes] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliatePcn(),
    getAvalPostCallNotes(),
  ]);

  // Cash Collected comes exclusively from the Marketing Daily Metrics form,
  // per the client — no layering in EOD Closer's own cash figure.
  const byDay = filterByMonth(getCashByDay(marketing), month);

  const postCallNoteClosed = postCallNotes
    .filter((r) => r.cashCollected !== null && r.cashCollected > 0)
    .map((r) => ({ leadEmail: r.leadEmail, cpaCash: r.cashCollected, date: r.date }));
  const bySourceDay = cashBySourceByDay(leads, [...pcn, ...postCallNoteClosed]);
  const bySourceForMonth: typeof bySourceDay = {};
  for (const [date, value] of Object.entries(bySourceDay)) {
    if (date.startsWith(month)) bySourceForMonth[date] = value;
  }

  return Response.json({ byDay, total: monthTotal(byDay), bySourceDay: bySourceForMonth });
}
