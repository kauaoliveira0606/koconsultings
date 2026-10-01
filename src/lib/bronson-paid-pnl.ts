import { isDateInRange, type ResolvedRange } from "@/lib/date-range";
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import {
  AGENCY_DATA_START,
  buildDailyOfferRows,
  sumSalesTeamPayout,
  withBronsonActualCommissions,
} from "@/lib/agency";
import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { COMMISSIONS_OFFERS, getPaidCommissionsByDay } from "@/lib/airtable/commissions";
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
  profit: number;
  /** True organic cash — nothing comes off it. */
  organicCash: number;
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
 * profit share — plus the organic cash for the same range (no deductions). Same rows and rules as the Agency page: paid cash and ad
 * spend from the Marketing Daily Metrics form, actual paid-traffic sales team
 * commissions, and the monthly bills (booked on the 1st of their month).
 *
 * Low ticket is shown as TRUE cash: the form logs what reps say they sold,
 * but the affiliate portal only pays what it tracked. The portal doesn't know
 * Paid from Organic, so its cash for the range is split in the same
 * proportion as the logged paid / organic low ticket cash.
 */
export async function getBronsonPaidPnl(range: ResolvedRange): Promise<PaidPnl> {
  const offer = COMMISSIONS_OFFERS.bronson;
  const [marketing, expenses, paidCommissions, portalRecords] = await Promise.all([
    getMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    getPaidCommissionsByDay(offer),
    airtableListAll<Record<string, unknown>>(offer.baseId, offer.affiliatePortalByRepTableId),
  ]);
  const rows = withBronsonActualCommissions(
    buildDailyOfferRows(
      marketing,
      expensesByMonth(effectiveExpenses(EXPENSE_TABLES.bronson, expenses))
    ),
    paidCommissions
  ).filter((r) => isDateInRange(r.date, range));

  const sumOf = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((t, r) => t + pick(r), 0);
  const loggedLowTicketPaid = sumOf((r) => r.ltCashPaid);
  const loggedLowTicketOrganic = sumOf((r) => r.ltCashOrganic);
  const loggedLowTicket = loggedLowTicketPaid + loggedLowTicketOrganic;

  let portalLowTicketCash = 0;
  for (const r of portalRecords) {
    const date = parseDateOnly(r.fields.Date);
    if (!date || date < AGENCY_DATA_START || !isDateInRange(date, range)) continue;
    portalLowTicketCash += parseNumericText(r.fields.Commission) ?? 0;
  }
  const lowTicketAttributionRate = loggedLowTicket > 0 ? portalLowTicketCash / loggedLowTicket : null;
  const rate = lowTicketAttributionRate ?? 1;

  const paidCashLowTicket = loggedLowTicketPaid * rate;
  const paidCashHighTicket = sumOf((r) => r.htCashPaid);
  const organicCashLowTicket = loggedLowTicketOrganic * rate;
  const organicCashHighTicket = sumOf((r) => r.htCashOrganic);
  const cash = paidCashLowTicket + paidCashHighTicket;
  const salesTeamCommission = sumSalesTeamPayout(rows).paid;
  const adSpend = sumOf((r) => r.adSpend);
  const expensesTotal = sumOf((r) => r.expenses);
  return {
    cash,
    salesTeamCommission,
    adSpend,
    expenses: expensesTotal,
    profit: cash - salesTeamCommission - adSpend - expensesTotal,
    organicCash: organicCashLowTicket + organicCashHighTicket,
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
