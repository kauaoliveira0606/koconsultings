import type { NextRequest } from "next/server";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import {
  filterByMonth,
  getAdSpendByDay,
  getCashByDay,
  getCashSourceByDay,
  monthTotal,
} from "@/lib/cash-calendar";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const marketing = await getMarketingDailyMetrics();

  // Cash Collected, its Paid/Organic split, and Ad Spend all come exclusively
  // from the Marketing Daily Metrics form — no Affiliate PCN/EOD
  // cross-reference. That cross-reference is independently submitted and
  // doesn't reliably sum to the real cash total; the form's own
  // "(Paid)"/"(Organic)" columns always do.
  const byDay = filterByMonth(getCashByDay(marketing), month);
  const adSpendByDay = filterByMonth(getAdSpendByDay(marketing), month);
  const bySourceDay = filterByMonth(getCashSourceByDay(marketing), month);

  return Response.json({
    byDay,
    total: monthTotal(byDay),
    bySourceDay,
    adSpendByDay,
  });
}
