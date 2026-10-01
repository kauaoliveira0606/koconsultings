import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getMarketingDailyMetrics as getBronsonMarketingDailyMetrics } from "@/lib/airtable/tables";
import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { getMarketingDailyMetrics as getEcomSimMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import {
  EXPENSE_TABLES,
  effectiveExpenses,
  expensesByMonth,
  listExpenses,
  reimbursementsByMonth,
} from "@/lib/airtable/expenses";
import {
  AGENCY_DATA_START,
  buildDailyOfferRows,
  untilAndyLeft,
  withBronsonActualCommissions,
  sumCash,
  sumAdSpend,
  sumExpenses,
  sumSalesTeamPayout,
  profit,
  bronsonAgencyProfit,
  avalAgencyProfit,
  ecomSimAgencyProfit,
  bronsonSalesManagerCut,
  ecomSimSalesManagerCut,
  type DailyOfferRow,
} from "@/lib/agency";
import { COMMISSIONS_OFFERS, getPaidCommissionsByDay } from "@/lib/airtable/commissions";

export const revalidate = 60;

function clientSummary(rows: DailyOfferRow[]) {
  const { paid, organic } = sumSalesTeamPayout(rows);
  return {
    cash: sumCash(rows),
    adSpend: sumAdSpend(rows),
    salesTeamPayout: paid + organic,
    expenses: sumExpenses(rows),
    profit: profit(rows),
  };
}

/** Aval is a straight 11.5% revenue share — no sales team comes out of it, only ad spend. */
function avalClientSummary(rows: DailyOfferRow[]) {
  const cash = sumCash(rows);
  const adSpend = sumAdSpend(rows);
  return { cash, adSpend, salesTeamPayout: 0, expenses: 0, profit: cash - adSpend };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [
    bronsonMarketing,
    avalMarketing,
    ecomMarketing,
    bronsonExpenses,
    ecomExpenses,
    bronsonPaidCommissions,
  ] = await Promise.all([
    getBronsonMarketingDailyMetrics(),
    getAvalMarketingDailyMetrics(),
    getEcomSimMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    listExpenses(EXPENSE_TABLES.ecomSimulation),
    getPaidCommissionsByDay(COMMISSIONS_OFFERS.bronson),
  ]);

  // Everything — cash, ad spend, Paid/Organic splits — comes straight from
  // each offer's Marketing Daily Metrics table, per the client. No EOD
  // Closer / Affiliate EOD blending here (unlike each offer's own
  // /overview/metrics route, which does blend those in for a more complete
  // real-time picture).
  // Bronson's sales team payout is the actual paid-traffic commission from its
  // Commissions tab (organic commissions are not deducted), not a cash estimate.
  const bronsonEffectiveExpenses = effectiveExpenses(EXPENSE_TABLES.bronson, bronsonExpenses);
  const bronsonAllRows = withBronsonActualCommissions(
    buildDailyOfferRows(bronsonMarketing, expensesByMonth(bronsonEffectiveExpenses)),
    bronsonPaidCommissions
  );
  const avalAllRows = buildDailyOfferRows(avalMarketing);
  const ecomAllRows = untilAndyLeft(
    buildDailyOfferRows(ecomMarketing, expensesByMonth(ecomExpenses))
  );

  // Bills the agency owner paid on his own card, booked on the 1st like every
  // expense. Bronson sends these back in full, on top of the profit split.
  let bronsonReimbursement = 0;
  for (const [month, total] of reimbursementsByMonth(bronsonEffectiveExpenses)) {
    const date = `${month}-01`;
    if (date >= AGENCY_DATA_START && isDateInRange(date, range)) bronsonReimbursement += total;
  }

  const bronsonRows = bronsonAllRows.filter((r) => isDateInRange(r.date, range));
  const avalRows = avalAllRows.filter((r) => isDateInRange(r.date, range));
  const ecomRows = ecomAllRows.filter((r) => isDateInRange(r.date, range));

  // Personal Profit = Agency Profit minus the sales manager's 5% cut, which
  // comes out of the agency owner's own split (Bronson + Andy only).
  const withPersonal = <T extends { agencyProfit: number }>(c: T, salesManagerCut: number) => ({
    ...c,
    salesManagerCut,
    personalProfit: c.agencyProfit - salesManagerCut,
  });
  const bronson = withPersonal(
    { ...clientSummary(bronsonRows), agencyProfit: bronsonAgencyProfit(bronsonRows) },
    bronsonSalesManagerCut(bronsonRows)
  );
  const aval = withPersonal(
    { ...avalClientSummary(avalRows), agencyProfit: avalAgencyProfit(avalRows) },
    0
  );
  const ecomSimulation = withPersonal(
    { ...clientSummary(ecomRows), agencyProfit: ecomSimAgencyProfit(ecomAllRows, range) },
    ecomSimSalesManagerCut(ecomRows)
  );

  // Bronson's paid-traffic P&L — the base of the 50% profit share.
  const paidCash = bronsonRows.reduce((t, r) => t + r.ltCashPaid + r.htCashPaid, 0);
  const paidCommission = sumSalesTeamPayout(bronsonRows).paid;
  const bronsonPaidPnl = {
    cash: paidCash,
    salesTeamCommission: paidCommission,
    adSpend: bronson.adSpend,
    expenses: bronson.expenses,
    profit: paidCash - paidCommission - bronson.adSpend - bronson.expenses,
  };

  const clients = { bronson, aval, ecomSimulation };
  const totalCashCollected = bronson.cash + aval.cash + ecomSimulation.cash;
  const totalAdSpend = bronson.adSpend + aval.adSpend + ecomSimulation.adSpend;
  const totalProfit = bronson.profit + aval.profit + ecomSimulation.profit;
  const totalExpenses = bronson.expenses + aval.expenses + ecomSimulation.expenses;
  const totalSalesTeamPayout =
    bronson.salesTeamPayout + aval.salesTeamPayout + ecomSimulation.salesTeamPayout;
  const totalAgencyProfit = bronson.agencyProfit + aval.agencyProfit + ecomSimulation.agencyProfit;
  const salesManagerCut =
    bronson.salesManagerCut + aval.salesManagerCut + ecomSimulation.salesManagerCut;
  const myProfit = bronson.personalProfit + aval.personalProfit + ecomSimulation.personalProfit;

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
    totalExpenses,
    totalAgencyProfit,
    salesManagerCut,
    myProfit,
    bronsonReimbursement,
    bronsonPaidPnl,
    bronsonTotalOwed: bronson.agencyProfit + bronsonReimbursement,
    blendedRoas: totalAdSpend > 0 ? totalCashCollected / totalAdSpend : null,
    clients,
    byDay,
  });
}
