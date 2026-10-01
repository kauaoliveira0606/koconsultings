import { isDateInRange, type ResolvedRange } from "@/lib/date-range";
import { buildDailyOfferRows, sumSalesTeamPayout, withBronsonActualCommissions } from "@/lib/agency";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { COMMISSIONS_OFFERS, getPaidCommissionsByDay } from "@/lib/airtable/commissions";
import {
  EXPENSE_TABLES,
  effectiveExpenses,
  expensesByMonth,
  listExpenses,
} from "@/lib/airtable/expenses";

export type PaidPnl = {
  cash: number;
  salesTeamCommission: number;
  adSpend: number;
  expenses: number;
  profit: number;
  /** Organic cash collected — nothing comes off it. */
  organicCash: number;
  organicCashLowTicket: number;
  organicCashHighTicket: number;
};

/**
 * Bronson's paid-traffic P&L for a range — the base of the agency's 50%
 * profit share — plus the organic cash for the same range (no deductions). Same rows and rules as the Agency page: paid cash and ad
 * spend from the Marketing Daily Metrics form, actual paid-traffic sales team
 * commissions, and the monthly bills (booked on the 1st of their month).
 */
export async function getBronsonPaidPnl(range: ResolvedRange): Promise<PaidPnl> {
  const [marketing, expenses, paidCommissions] = await Promise.all([
    getMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    getPaidCommissionsByDay(COMMISSIONS_OFFERS.bronson),
  ]);
  const rows = withBronsonActualCommissions(
    buildDailyOfferRows(
      marketing,
      expensesByMonth(effectiveExpenses(EXPENSE_TABLES.bronson, expenses))
    ),
    paidCommissions
  ).filter((r) => isDateInRange(r.date, range));

  const cash = rows.reduce((t, r) => t + r.ltCashPaid + r.htCashPaid, 0);
  const salesTeamCommission = sumSalesTeamPayout(rows).paid;
  const adSpend = rows.reduce((t, r) => t + r.adSpend, 0);
  const organicCashLowTicket = rows.reduce((t, r) => t + r.ltCashOrganic, 0);
  const organicCashHighTicket = rows.reduce((t, r) => t + r.htCashOrganic, 0);
  const expensesTotal = rows.reduce((t, r) => t + r.expenses, 0);
  return {
    cash,
    salesTeamCommission,
    adSpend,
    expenses: expensesTotal,
    profit: cash - salesTeamCommission - adSpend - expensesTotal,
    organicCash: organicCashLowTicket + organicCashHighTicket,
    organicCashLowTicket,
    organicCashHighTicket,
  };
}
