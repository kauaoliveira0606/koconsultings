import type { NextRequest } from "next/server";
import {
  getMarketingDailyMetrics as getBronsonMarketingDailyMetrics,
  getBronsonAffiliateEod,
  getBronsonEodCloser,
} from "@/lib/airtable/tables";
import {
  getAvalMarketingDailyMetrics,
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
} from "@/lib/airtable/tables-aval";
import {
  getMarketingDailyMetrics as getEcomSimMarketingDailyMetrics,
  getAffiliateEod as getEcomSimAffiliateEod,
  getEodCloser as getEcomSimEodCloser,
} from "@/lib/airtable/tables-ecom-simulation";
import {
  buildDailyOfferRows,
  blendHtCashByDay,
  cash,
  bronsonAgencyProfitByDay,
  avalAgencyProfitByDay,
  ecomSimAgencyProfitByDay,
  type DailyOfferRow,
} from "@/lib/agency";

export const revalidate = 60;

function cashByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, cash(r));
  return map;
}

/**
 * Evergreen day-by-day breakdown, independent of the page's global date
 * range picker — always browsable by calendar month, same UX as each
 * offer's own Cash Calendar section.
 */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const [
    bronsonMarketing,
    bronsonEod,
    bronsonCloser,
    avalMarketing,
    avalEod,
    avalCloser,
    ecomMarketing,
    ecomEod,
    ecomCloser,
  ] = await Promise.all([
    getBronsonMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getAvalMarketingDailyMetrics(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getEcomSimMarketingDailyMetrics(),
    getEcomSimAffiliateEod(),
    getEcomSimEodCloser(),
  ]);

  const bronsonRows = buildDailyOfferRows(
    bronsonMarketing,
    blendHtCashByDay(bronsonMarketing, [bronsonEod, bronsonCloser])
  );
  const avalRows = buildDailyOfferRows(
    avalMarketing,
    blendHtCashByDay(avalMarketing, [avalEod, avalCloser])
  );
  const ecomRows = buildDailyOfferRows(
    ecomMarketing,
    blendHtCashByDay(ecomMarketing, [ecomCloser, ecomEod])
  );

  const bronsonAgencyByDay = bronsonAgencyProfitByDay(bronsonRows);
  const avalAgencyByDay = avalAgencyProfitByDay(avalRows);
  const ecomAgencyByDay = ecomSimAgencyProfitByDay(ecomRows);
  const bronsonCashByDay = cashByDay(bronsonRows);
  const avalCashByDay = cashByDay(avalRows);
  const ecomCashByDay = cashByDay(ecomRows);

  const dates = new Set<string>(
    [...bronsonRows, ...avalRows, ...ecomRows].map((r) => r.date).filter((d) => d.startsWith(month))
  );

  const byDay: Record<
    string,
    {
      agencyProfit: number;
      totalCash: number;
      myProfit: number;
      byClient: { bronson: number; aval: number; ecomSimulation: number };
    }
  > = {};

  let monthAgencyProfit = 0;
  let monthTotalCash = 0;

  for (const date of dates) {
    const byClient = {
      bronson: bronsonAgencyByDay.get(date) ?? 0,
      aval: avalAgencyByDay.get(date) ?? 0,
      ecomSimulation: ecomAgencyByDay.get(date) ?? 0,
    };
    const agencyProfit = byClient.bronson + byClient.aval + byClient.ecomSimulation;
    const totalCash =
      (bronsonCashByDay.get(date) ?? 0) + (avalCashByDay.get(date) ?? 0) + (ecomCashByDay.get(date) ?? 0);
    // Sales manager takes 5% of agency profit — same split as the top-level stat cards, applied per day.
    const myProfit = agencyProfit * 0.95;

    byDay[date] = { agencyProfit, totalCash, myProfit, byClient };
    monthAgencyProfit += agencyProfit;
    monthTotalCash += totalCash;
  }

  return Response.json({
    byDay,
    monthTotal: {
      agencyProfit: monthAgencyProfit,
      totalCash: monthTotalCash,
      myProfit: monthAgencyProfit * 0.95,
    },
  });
}
