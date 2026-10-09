import type { NextRequest } from "next/server";
import {
  BRONSON_BASE_ID,
  getMarketingDailyMetrics as getBronsonMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { AVAL_BASE_ID, getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { getMarketingDailyMetrics as getEcomSimMarketingDailyMetrics } from "@/lib/airtable/tables-ecom-simulation";
import {
  EXPENSE_TABLES,
  effectiveExpenses,
  expensesByMonth,
  listExpenses,
} from "@/lib/airtable/expenses";
import {
  buildDailyOfferRows,
  untilAndyLeft,
  withAttributedLowTicket,
  withBronsonActualCommissions,
  withAvalProfitSplit,
  withDealFees,
  cash,
  bronsonAgencyProfitByDay,
  avalAgencyProfitByDay,
  ecomSimAgencyProfitByDay,
  bronsonSalesManagerCutByDay,
  ecomSimSalesManagerCutByDay,
  type DailyOfferRow,
} from "@/lib/agency";
import { DEAL_FEE_RATES } from "@/lib/deal-fee-rates";
import { getFinancedHighTicketCashByDay } from "@/lib/deal-fees";
import {
  COMMISSIONS_OFFERS,
  getPaidCommissionsByDay,
  getPortalCashByDay,
} from "@/lib/airtable/commissions";

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
    avalMarketing,
    ecomMarketing,
    bronsonExpenses,
    ecomExpenses,
    bronsonPaidCommissions,
    bronsonPortalCash,
    bronsonFinanced,
    avalFinanced,
  ] = await Promise.all([
    getBronsonMarketingDailyMetrics(),
    getAvalMarketingDailyMetrics(),
    getEcomSimMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    listExpenses(EXPENSE_TABLES.ecomSimulation),
    getPaidCommissionsByDay(COMMISSIONS_OFFERS.bronson),
    getPortalCashByDay(COMMISSIONS_OFFERS.bronson),
    getFinancedHighTicketCashByDay(BRONSON_BASE_ID),
    getFinancedHighTicketCashByDay(AVAL_BASE_ID),
  ]);

  // Everything comes straight from each offer's Marketing Daily Metrics
  // table, per the client — no EOD Closer / Affiliate EOD blending.
  // Bronson's low ticket is true (portal-attributed) cash, not the logged
  // figure — same as the metrics route.
  const bronsonRows = withDealFees(
    withAttributedLowTicket(
      withBronsonActualCommissions(
        buildDailyOfferRows(
          bronsonMarketing,
          expensesByMonth(effectiveExpenses(EXPENSE_TABLES.bronson, bronsonExpenses))
        ),
        bronsonPaidCommissions
      ),
      bronsonPortalCash
    ),
    bronsonFinanced,
    DEAL_FEE_RATES.bronson
  );
  // Aval stays on logged cash: it is paid out differently, per the client.
  const avalRows = withDealFees(
    withAvalProfitSplit(buildDailyOfferRows(avalMarketing)),
    avalFinanced,
    DEAL_FEE_RATES.aval
  );
  const ecomRows = untilAndyLeft(buildDailyOfferRows(ecomMarketing, expensesByMonth(ecomExpenses)));

  const bronsonAgencyByDay = bronsonAgencyProfitByDay(bronsonRows);
  const avalAgencyByDay = avalAgencyProfitByDay(avalRows);
  const ecomAgencyByDay = ecomSimAgencyProfitByDay(ecomRows);
  const bronsonCashByDay = cashByDay(bronsonRows);
  const avalCashByDay = cashByDay(avalRows);
  const ecomCashByDay = cashByDay(ecomRows);
  // Sales manager's 5% cut, Bronson and Andy only — no cut on Aval — same
  // rule as the top-level stat cards and By Client table, applied per day.
  const bronsonManagerCutByDay = bronsonSalesManagerCutByDay(bronsonRows);
  const ecomManagerCutByDay = ecomSimSalesManagerCutByDay(ecomRows);

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
  let monthSalesManagerCut = 0;

  for (const date of dates) {
    const bronsonAgency = bronsonAgencyByDay.get(date) ?? 0;
    const avalAgency = avalAgencyByDay.get(date) ?? 0;
    const ecomAgency = ecomAgencyByDay.get(date) ?? 0;
    const agencyProfit = bronsonAgency + avalAgency + ecomAgency;
    const totalCash =
      (bronsonCashByDay.get(date) ?? 0) + (avalCashByDay.get(date) ?? 0) + (ecomCashByDay.get(date) ?? 0);
    const bronsonManagerCut = bronsonManagerCutByDay.get(date) ?? 0;
    const ecomManagerCut = ecomManagerCutByDay.get(date) ?? 0;
    const salesManagerCut = bronsonManagerCut + ecomManagerCut;
    const myProfit = agencyProfit - salesManagerCut;
    // Per-client figures are personal profit — each client's agency share
    // minus the sales manager's cut on it — so B + A + E = myProfit.
    const byClient = {
      bronson: bronsonAgency - bronsonManagerCut,
      aval: avalAgency,
      ecomSimulation: ecomAgency - ecomManagerCut,
    };

    byDay[date] = { agencyProfit, totalCash, myProfit, byClient };
    monthAgencyProfit += agencyProfit;
    monthTotalCash += totalCash;
    monthSalesManagerCut += salesManagerCut;
  }

  return Response.json({
    byDay,
    monthTotal: {
      agencyProfit: monthAgencyProfit,
      totalCash: monthTotalCash,
      myProfit: monthAgencyProfit - monthSalesManagerCut,
    },
  });
}
