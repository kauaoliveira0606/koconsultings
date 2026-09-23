import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getMarketingDailyMetrics as getBronsonMarketingDailyMetrics } from "@/lib/airtable/tables";
import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { getMarketingDailyMetrics as getEcomSimMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import {
  buildDailyOfferRows,
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

/** Aval is a straight 11.5% revenue share — no sales team comes out of it, only ad spend. */
function avalClientSummary(rows: DailyOfferRow[]) {
  const cash = sumCash(rows);
  const adSpend = sumAdSpend(rows);
  return { cash, adSpend, salesTeamPayout: 0, profit: cash - adSpend };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [bronsonMarketing, avalMarketing, ecomMarketing] = await Promise.all([
    getBronsonMarketingDailyMetrics(),
    getAvalMarketingDailyMetrics(),
    getEcomSimMarketingDailyMetrics(),
  ]);

  // Everything — cash, ad spend, Paid/Organic splits — comes straight from
  // each offer's Marketing Daily Metrics table, per the client. No EOD
  // Closer / Affiliate EOD blending here (unlike each offer's own
  // /overview/metrics route, which does blend those in for a more complete
  // real-time picture).
  const bronsonAllRows = buildDailyOfferRows(bronsonMarketing);
  const avalAllRows = buildDailyOfferRows(avalMarketing);
  const ecomAllRows = buildDailyOfferRows(ecomMarketing);

  const bronsonRows = bronsonAllRows.filter((r) => isDateInRange(r.date, range));
  const avalRows = avalAllRows.filter((r) => isDateInRange(r.date, range));
  const ecomRows = ecomAllRows.filter((r) => isDateInRange(r.date, range));

  const bronson = { ...clientSummary(bronsonRows), agencyProfit: bronsonAgencyProfit(bronsonRows) };
  const aval = { ...avalClientSummary(avalRows), agencyProfit: avalAgencyProfit(avalRows) };
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
  // Sales manager gets 5% of Net Cash (not Agency Profit) on Bronson and
  // Andy only — no cut on Aval at all. Paid personally out of the agency
  // owner's own take-home, so it's subtracted from My Profit, not spread
  // across the total Agency Profit line.
  const salesManagerCut = 0.05 * (bronson.profit + ecomSimulation.profit);
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
