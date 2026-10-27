import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { addDaysToDateString, easternDateString, isDateInRange } from "@/lib/date-range";
import {
  BRONSON_BASE_ID,
  getMarketingDailyMetrics as getBronsonMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { AVAL_BASE_ID, getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
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
  withAttributedLowTicket,
  withBronsonActualCommissions,
  withAvalProfitSplit,
  withDealFees,
  sumCash,
  sumAdSpend,
  sumExpenses,
  sumSalesTeamPayout,
  sumFees,
  profit,
  bronsonAgencyProfit,
  bronsonSplitBreakdown,
  avalAgencyProfit,
  bronsonSalesManagerCut,
  type DailyOfferRow,
  paidCash,
  organicCash,
} from "@/lib/agency";
import { DEAL_FEE_RATES } from "@/lib/deal-fee-rates";
import { getFinancedHighTicketCashByDay } from "@/lib/deal-fees";
import {
  COMMISSIONS_OFFERS,
  getCommissionsByDay,
  getPortalCashByDay,
} from "@/lib/airtable/commissions";

export const revalidate = 60;

function clientSummary(rows: DailyOfferRow[]) {
  const { paid, organic } = sumSalesTeamPayout(rows);
  const fees = sumFees(rows);
  return {
    fees: fees.paid + fees.organic,
    cash: sumCash(rows),
    adSpend: sumAdSpend(rows),
    salesTeamPayout: paid + organic,
    expenses: sumExpenses(rows),
    profit: profit(rows),
  };
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [
    bronsonMarketing,
    avalMarketing,
    bronsonExpenses,
    bronsonCommissions,
    bronsonPortalCash,
    bronsonFinanced,
    avalFinanced,
  ] = await Promise.all([
    getBronsonMarketingDailyMetrics(),
    getAvalMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    getCommissionsByDay(COMMISSIONS_OFFERS.bronson),
    getPortalCashByDay(COMMISSIONS_OFFERS.bronson),
    getFinancedHighTicketCashByDay(BRONSON_BASE_ID),
    getFinancedHighTicketCashByDay(AVAL_BASE_ID),
  ]);

  // Everything — cash, ad spend, Paid/Organic splits — comes straight from
  // each offer's Marketing Daily Metrics table, per the client. No EOD
  // Closer / Affiliate EOD blending here (unlike each offer's own
  // /overview/metrics route, which does blend those in for a more complete
  // real-time picture).
  // Bronson's sales team payout is the actual commission from its Commissions
  // tab, not a cash estimate. All of it shows; only the paid-traffic part comes
  // off the profit split.
  const bronsonEffectiveExpenses = effectiveExpenses(EXPENSE_TABLES.bronson, bronsonExpenses);
  // Bronson's low ticket cash is TRUE cash (what the affiliate portal tracked
  // and pays), not what was logged on the form.
  // Processing and financing fees on high ticket cash come off both clients' profit.
  const bronsonAllRows = withDealFees(
    withAttributedLowTicket(
      withBronsonActualCommissions(
        buildDailyOfferRows(bronsonMarketing, expensesByMonth(bronsonEffectiveExpenses)),
        bronsonCommissions.paidByDay,
        bronsonCommissions.organicByDay
      ),
      bronsonPortalCash
    ),
    bronsonFinanced,
    DEAL_FEE_RATES.bronson
  );
  // Aval stays on logged cash: it is paid out differently, per the client.
  const avalAllRows = withDealFees(
    withAvalProfitSplit(buildDailyOfferRows(avalMarketing)),
    avalFinanced,
    DEAL_FEE_RATES.aval
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

  // Personal Profit = Agency Profit minus the sales manager's 5% cut, which
  // comes out of the agency owner's own split (Bronson only, and only
  // through September 2026: there is no sales manager after that).
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
    { ...clientSummary(avalRows), agencyProfit: avalAgencyProfit(avalRows) },
    0
  );

  const clients = { bronson, aval };
  const totalCashCollected = bronson.cash + aval.cash;
  const totalAdSpend = bronson.adSpend + aval.adSpend;
  const totalProfit = bronson.profit + aval.profit;
  const totalExpenses = bronson.expenses + aval.expenses;
  const totalSalesTeamPayout = bronson.salesTeamPayout + aval.salesTeamPayout;
  const totalFees = bronson.fees + aval.fees;
  const totalAgencyProfit = bronson.agencyProfit + aval.agencyProfit;
  const salesManagerCut = bronson.salesManagerCut + aval.salesManagerCut;
  const myProfit = bronson.personalProfit + aval.personalProfit;

  const byDayMap = new Map<string, { cash: number; adSpend: number }>();
  for (const rows of [bronsonRows, avalRows]) {
    for (const r of rows) {
      const cash = paidCash(r) + organicCash(r);
      const existing = byDayMap.get(r.date) ?? { cash: 0, adSpend: 0 };
      existing.cash += cash;
      existing.adSpend += r.adSpend;
      byDayMap.set(r.date, existing);
    }
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // This month's pace, whatever range is picked: completed days only. Today
  // never counts, and yesterday waits until both offers' forms are in, same
  // as the Scorecard's pacing. Bills are booked once a month, so they come
  // off the projection as they are instead of being scaled up.
  const today = easternDateString();
  const yesterday = addDaysToDateString(today, -1);
  const formsIn = [bronsonMarketing, avalMarketing].every((rows) => rows.some((r) => r.date === yesterday));
  const through = formsIn ? yesterday : addDaysToDateString(yesterday, -1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [year, month] = today.split("-").map(Number);
  const daysTotal = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysElapsed = through >= monthStart ? Number(through.slice(8, 10)) : 0;
  const inMonth = (r: DailyOfferRow) => r.date >= monthStart && r.date <= through;
  let pacing = null;
  if (daysElapsed > 0) {
    const scale = daysTotal / daysElapsed;
    const bronsonMonth = bronsonAllRows.filter(inMonth);
    const avalMonth = avalAllRows.filter(inMonth);
    const split = bronsonSplitBreakdown(bronsonMonth);
    const bills = sumExpenses(bronsonMonth);
    const paidProfit = (split.paidProfit + bills) * scale - bills;
    const organicNet = split.organicNet * scale;
    // Same rule as the split: a losing paid month comes off organic before the 20%.
    const bronsonShare = paidProfit < 0 ? 0.2 * (organicNet + paidProfit) : 0.5 * paidProfit + 0.2 * organicNet;
    const avalShare = avalAgencyProfit(avalMonth) * scale;
    const cashToDate = sumCash(bronsonMonth) + sumCash(avalMonth);
    pacing = {
      monthStart,
      through,
      daysElapsed,
      daysTotal,
      cashToDate,
      cash: cashToDate * scale,
      myProfitToDate: bronsonAgencyProfit(bronsonMonth) + avalAgencyProfit(avalMonth),
      bronsonShare,
      avalShare,
      myProfit: bronsonShare + avalShare,
    };
  }

  return Response.json({
    pacing,
    totalCashCollected,
    totalAdSpend,
    totalProfit,
    totalSalesTeamPayout,
    totalExpenses,
    totalFees,
    totalAgencyProfit,
    salesManagerCut,
    myProfit,
    bronsonReimbursement,
    bronsonTotalOwed: bronson.agencyProfit + bronsonReimbursement,
    bronsonSplit: bronsonSplitBreakdown(bronsonRows),
    blendedRoas: totalAdSpend > 0 ? totalCashCollected / totalAdSpend : null,
    clients,
    byDay,
  });
}
