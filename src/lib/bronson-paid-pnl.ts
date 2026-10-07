import { isDateInRange, type ResolvedRange } from "@/lib/date-range";
import {
  buildDailyOfferRows,
  sumFees,
  sumSalesTeamPayout,
  withAttributedLowTicket,
  withBronsonActualCommissions,
  withDealFees,
  type DailyOfferRow,
} from "@/lib/agency";
import { BRONSON_BASE_ID, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { getFinancedHighTicketCashByDay } from "@/lib/deal-fees";
import {
  COMMISSIONS_OFFERS,
  getPaidCommissionsByDay,
  getPortalCashByDay,
} from "@/lib/airtable/commissions";
import {
  EXPENSE_TABLES,
  effectiveExpenses,
  expensesByMonth,
  listExpenses,
} from "@/lib/airtable/expenses";

export type PaidPnl = {
  /** True paid cash: attributed low ticket + high ticket. */
  cash: number;
  salesTeamCommission: number;
  adSpend: number;
  expenses: number;
  /** Processing + financing fees on paid high ticket cash (from October 2026). */
  fees: number;
  profit: number;
  /** True organic cash, before its high ticket fees. */
  organicCash: number;
  /** Processing + financing fees on organic high ticket cash (from October 2026): the only thing that comes off organic. */
  organicFees: number;
  organicCashLowTicket: number;
  organicCashHighTicket: number;
  paidCashLowTicket: number;
  paidCashHighTicket: number;
  /** Low ticket as logged on the Marketing Daily Metrics form, before attribution. */
  loggedLowTicketPaid: number;
  loggedLowTicketOrganic: number;
  /** What the affiliate portal actually tracked (reversed sales taken out), every Shared ID. */
  portalLowTicketCash: number;
  /** portalLowTicketCash / logged low ticket cash; null when nothing was logged. */
  lowTicketAttributionRate: number | null;
};

/**
 * Bronson's paid-traffic P&L for a range — the base of the agency's 50%
 * profit share — plus the organic cash for the same range (only its high ticket fees come off). Same rows and rules as the Agency page: paid cash and ad
 * spend from the Marketing Daily Metrics form, actual paid-traffic sales team
 * commissions, and the monthly bills (booked on the 1st of their month).
 *
 * Low ticket is shown as TRUE cash: the form logs what reps say they sold,
 * but the affiliate portal only pays what it tracked. The portal doesn't know
 * Paid from Organic, so each month's portal cash is split in the same
 * proportion as that month's logged paid / organic low ticket cash
 * (`withAttributedLowTicket`, shared with the Agency page).
 */
export async function getBronsonPaidPnl(range: ResolvedRange): Promise<PaidPnl> {
  const offer = COMMISSIONS_OFFERS.bronson;
  const [marketing, expenses, paidCommissions, portalCashByDay, financedByDay] = await Promise.all([
    getMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    getPaidCommissionsByDay(offer),
    getPortalCashByDay(offer),
    getFinancedHighTicketCashByDay(BRONSON_BASE_ID),
  ]);
  const loggedRows = withBronsonActualCommissions(
    buildDailyOfferRows(
      marketing,
      expensesByMonth(effectiveExpenses(EXPENSE_TABLES.bronson, expenses))
    ),
    paidCommissions
  );
  const inRange = (r: DailyOfferRow) => isDateInRange(r.date, range);
  const logged = loggedRows.filter(inRange);
  // Exactly the rows the Agency page uses, so the two always agree.
  const rows = withDealFees(
    withAttributedLowTicket(loggedRows, portalCashByDay),
    financedByDay
  ).filter(inRange);

  const sumOf = (list: DailyOfferRow[], pick: (r: DailyOfferRow) => number) =>
    list.reduce((t, r) => t + pick(r), 0);
  const loggedLowTicketPaid = sumOf(logged, (r) => r.ltCashPaid);
  const loggedLowTicketOrganic = sumOf(logged, (r) => r.ltCashOrganic);
  const loggedLowTicket = loggedLowTicketPaid + loggedLowTicketOrganic;

  const paidCashLowTicket = sumOf(rows, (r) => r.ltCashPaid);
  const paidCashHighTicket = sumOf(rows, (r) => r.htCashPaid);
  const organicCashLowTicket = sumOf(rows, (r) => r.ltCashOrganic);
  const organicCashHighTicket = sumOf(rows, (r) => r.htCashOrganic);
  const portalLowTicketCash = paidCashLowTicket + organicCashLowTicket;
  const lowTicketAttributionRate = loggedLowTicket > 0 ? portalLowTicketCash / loggedLowTicket : null;
  const cash = paidCashLowTicket + paidCashHighTicket;
  const salesTeamCommission = sumSalesTeamPayout(rows).paid;
  const adSpend = sumOf(rows, (r) => r.adSpend);
  const expensesTotal = sumOf(rows, (r) => r.expenses);
  const { paid: fees, organic: organicFees } = sumFees(rows);
  return {
    cash,
    salesTeamCommission,
    adSpend,
    expenses: expensesTotal,
    fees,
    profit: cash - salesTeamCommission - adSpend - expensesTotal - fees,
    organicCash: organicCashLowTicket + organicCashHighTicket,
    organicFees,
    organicCashLowTicket,
    organicCashHighTicket,
    paidCashLowTicket,
    paidCashHighTicket,
    loggedLowTicketPaid,
    loggedLowTicketOrganic,
    portalLowTicketCash,
    lowTicketAttributionRate,
  };
}
