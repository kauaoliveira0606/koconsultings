import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
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
  sumCash,
  sumAdSpend,
  sumSalesTeamPayout,
  profit,
  bronsonAgencyProfit,
  avalAgencyProfit,
  ecomSimAgencyProfit,
  type DailyOfferRow,
} from "@/lib/agency";

export const revalidate = 60;

function clientSummary(rows: DailyOfferRow[]) {
  const { paid, organic } = sumSalesTeamPayout(rows);
  return {
    cash: sumCash(rows),
    adSpend: sumAdSpend(rows),
    salesTeamPayout: paid + organic,
    profit: profit(rows),
  };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

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

  // Bronson & Aval prefer Affiliate EOD over EOD Closer for real HT cash;
  // Ecom Simulation prefers EOD Closer over Affiliate EOD — same order as
  // each offer's own /overview/metrics route.
  const bronsonHtByDay = blendHtCashByDay(bronsonMarketing, [bronsonEod, bronsonCloser]);
  const avalHtByDay = blendHtCashByDay(avalMarketing, [avalEod, avalCloser]);
  const ecomHtByDay = blendHtCashByDay(ecomMarketing, [ecomCloser, ecomEod]);

  const bronsonAllRows = buildDailyOfferRows(bronsonMarketing, bronsonHtByDay);
  const avalAllRows = buildDailyOfferRows(avalMarketing, avalHtByDay);
  const ecomAllRows = buildDailyOfferRows(ecomMarketing, ecomHtByDay);

  const bronsonRows = bronsonAllRows.filter((r) => isDateInRange(r.date, range));
  const avalRows = avalAllRows.filter((r) => isDateInRange(r.date, range));
  const ecomRows = ecomAllRows.filter((r) => isDateInRange(r.date, range));

  const bronson = { ...clientSummary(bronsonRows), agencyProfit: bronsonAgencyProfit(bronsonRows) };
  const aval = { ...clientSummary(avalRows), agencyProfit: avalAgencyProfit(avalRows) };
  const ecomSimulation = {
    ...clientSummary(ecomRows),
    agencyProfit: ecomSimAgencyProfit(ecomAllRows, range),
  };

  const clients = { bronson, aval, ecomSimulation };
  const totalCashCollected = bronson.cash + aval.cash + ecomSimulation.cash;
  const totalAdSpend = bronson.adSpend + aval.adSpend + ecomSimulation.adSpend;
  const totalProfit = bronson.profit + aval.profit + ecomSimulation.profit;
  const totalSalesTeamPayout =
    bronson.salesTeamPayout + aval.salesTeamPayout + ecomSimulation.salesTeamPayout;
  const totalAgencyProfit = bronson.agencyProfit + aval.agencyProfit + ecomSimulation.agencyProfit;
  // Sales manager takes 5% of total agency profit; the rest is personal take-home.
  const salesManagerCut = totalAgencyProfit * 0.05;
  const myProfit = totalAgencyProfit - salesManagerCut;

  const byDayMap = new Map<string, { cash: number; adSpend: number }>();
  for (const rows of [bronsonRows, avalRows, ecomRows]) {
    for (const r of rows) {
      const cash = r.ltCashPaid + r.ltCashOrganic + r.htCashPaid + r.htCashOrganic;
      const existing = byDayMap.get(r.date) ?? { cash: 0, adSpend: 0 };
      existing.cash += cash;
      existing.adSpend += r.adSpend;
      byDayMap.set(r.date, existing);
    }
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return Response.json({
    totalCashCollected,
    totalAdSpend,
    totalProfit,
    totalSalesTeamPayout,
    totalAgencyProfit,
    salesManagerCut,
    myProfit,
    blendedRoas: totalAdSpend > 0 ? totalCashCollected / totalAdSpend : null,
    clients,
    byDay,
  });
}
