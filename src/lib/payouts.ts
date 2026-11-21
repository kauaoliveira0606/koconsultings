/**
 * Admin Team "Payouts": the cash each offer collected, what comes off it, and
 * the payable share, i.e. the cash the agency's split is taken on. Built from
 * exactly the rows the Agency page uses, so the two always agree.
 */
import { BRONSON_BASE_ID, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { AVAL_BASE_ID, getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { AARON_BASE_ID, getAaronMarketingDailyMetrics } from "@/lib/airtable/tables-aaron";
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
import {
  bronsonAgencyProfit,
  buildDailyOfferRows,
  organicCash,
  paidCash,
  sumAdSpend,
  sumExpenses,
  sumFees,
  sumSalesTeamPayout,
  withAttributedLowTicket,
  withAvalProfitSplit,
  withBronsonActualCommissions,
  withDealFees,
  type DailyOfferRow,
} from "@/lib/agency";
import { DEAL_FEE_RATES } from "@/lib/deal-fee-rates";
import { getFinancedHighTicketCashByDay } from "@/lib/deal-fees";
import { isDateInRange, type ResolvedRange } from "@/lib/date-range";

export type PayoutsOffer = "bronson" | "aval" | "aaron";

/**
 * Aaron's deal (user, 2026-11-21): our share of NET PROFIT by product and traffic source.
 * Base44 (affiliate front end): 70% paid, 30% organic. High ticket: 50% paid, 30% organic.
 */
const AARON_SHARE = { affiliatePaid: 0.7, affiliateOrganic: 0.3, highTicketPaid: 0.5, highTicketOrganic: 0.3 };
/** Aaron's sales team: flat 10% on affiliate cash every day ($25 monthly / $27.50 yearly sale), 15% on high ticket. */
const AARON_AFFILIATE_COMMISSION = 0.1;
const AARON_HIGH_TICKET_COMMISSION = 0.15;

/**
 * Net profit per leg, then each leg's rate. Ad spend is paid traffic only and
 * is split between the paid Base44 cash and the paid high ticket cash in
 * proportion to each one's paid cash that day (all on Base44 when neither
 * has cash). Fees are high ticket only.
 */
function aaronAgencyShare(rows: DailyOfferRow[]): number {
  let total = 0;
  for (const r of rows) {
    const paidTotal = r.ltCashPaid + r.htCashPaid;
    const ltAdShare = paidTotal > 0 ? r.ltCashPaid / paidTotal : 1;
    const ltPaidNet = r.ltCashPaid * (1 - AARON_AFFILIATE_COMMISSION) - r.adSpend * ltAdShare;
    const htPaidNet =
      r.htCashPaid * (1 - AARON_HIGH_TICKET_COMMISSION) - r.adSpend * (1 - ltAdShare) - (r.fees?.paid ?? 0);
    const ltOrganicNet = r.ltCashOrganic * (1 - AARON_AFFILIATE_COMMISSION);
    const htOrganicNet = r.htCashOrganic * (1 - AARON_HIGH_TICKET_COMMISSION) - (r.fees?.organic ?? 0);
    total +=
      AARON_SHARE.affiliatePaid * ltPaidNet +
      AARON_SHARE.highTicketPaid * htPaidNet +
      AARON_SHARE.affiliateOrganic * ltOrganicNet +
      AARON_SHARE.highTicketOrganic * htOrganicNet;
  }
  return total;
}

/** Share shown on Aval's Payouts "Our Share" card only. Nothing else uses it. */
const AVAL_PAYOUTS_SHARE = 0.35;

export type Payouts = {
  offer: PayoutsOffer;
  cashAffiliate: number;
  cashVip: number;
  /** Bronson AI subscriptions. Always 0 on Aval. */
  cashAi: number;
  cashHighTicket: number;
  totalCash: number;
  adSpend: number;
  salesTeamPayout: number;
  /** Processing + financing fees: they come off before the share too. */
  fees: number;
  /** Monthly bills (Bronson only). */
  expenses: number;
  /** The cash the split is taken on, paid and organic. */
  payablePaid: number;
  payableOrganic: number;
  payableShare: number;
  /** What the split on that cash comes to. */
  agencyShare: number;
};

async function bronsonRows(): Promise<DailyOfferRow[]> {
  const offer = COMMISSIONS_OFFERS.bronson;
  const [marketing, expenses, paidCommissions, portalCash, financed] = await Promise.all([
    getMarketingDailyMetrics(),
    listExpenses(EXPENSE_TABLES.bronson),
    getPaidCommissionsByDay(offer),
    getPortalCashByDay(offer),
    getFinancedHighTicketCashByDay(BRONSON_BASE_ID),
  ]);
  return withDealFees(
    withAttributedLowTicket(
      withBronsonActualCommissions(
        buildDailyOfferRows(
          marketing,
          expensesByMonth(effectiveExpenses(EXPENSE_TABLES.bronson, expenses))
        ),
        paidCommissions
      ),
      portalCash
    ),
    financed,
    DEAL_FEE_RATES.bronson
  );
}

async function avalRows(): Promise<DailyOfferRow[]> {
  const [marketing, financed] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getFinancedHighTicketCashByDay(AVAL_BASE_ID),
  ]);
  return withDealFees(
    withAvalProfitSplit(buildDailyOfferRows(marketing)),
    financed,
    DEAL_FEE_RATES.aval
  );
}

/** Aaron: same shape as Aval (affiliate + high ticket), no profit split start date, no bills. */
async function aaronRows(): Promise<DailyOfferRow[]> {
  const [marketing, financed] = await Promise.all([
    getAaronMarketingDailyMetrics(),
    getFinancedHighTicketCashByDay(AARON_BASE_ID),
  ]);
  const rows = buildDailyOfferRows(marketing).map((r) => ({
    ...r,
    salesTeamPayout: {
      paid: r.ltCashPaid * AARON_AFFILIATE_COMMISSION + r.htCashPaid * AARON_HIGH_TICKET_COMMISSION,
      organic: r.ltCashOrganic * AARON_AFFILIATE_COMMISSION + r.htCashOrganic * AARON_HIGH_TICKET_COMMISSION,
    },
  }));
  return withDealFees(rows, financed, DEAL_FEE_RATES.aaron);
}

export async function getPayouts(offer: PayoutsOffer, range: ResolvedRange): Promise<Payouts> {
  const rows = (await (offer === "bronson" ? bronsonRows() : offer === "aaron" ? aaronRows() : avalRows())).filter((r) =>
    isDateInRange(r.date, range)
  );
  const sumOf = (pick: (r: DailyOfferRow) => number) => rows.reduce((t, r) => t + pick(r), 0);
  const cashAffiliate = sumOf((r) => r.ltCashPaid + r.ltCashOrganic);
  const cashVip = sumOf((r) => (r.vipCashPaid ?? 0) + (r.vipCashOrganic ?? 0));
  const cashAi = sumOf((r) => (r.aiCashPaid ?? 0) + (r.aiCashOrganic ?? 0));
  const cashHighTicket = sumOf((r) => r.htCashPaid + r.htCashOrganic);
  const adSpend = sumAdSpend(rows);
  const payout = sumSalesTeamPayout(rows);
  const fees = sumFees(rows);
  const expenses = sumExpenses(rows);
  // Bronson: ad spend, paid commissions and bills all come off the paid side;
  // organic only loses its fees. Aval: everything comes off one pot (no bills),
  // split here by where the cash and commissions came from.
  const payablePaid =
    sumOf(paidCash) - adSpend - payout.paid - fees.paid - (offer === "bronson" ? expenses : 0);
  const payableOrganic = sumOf(organicCash) - payout.organic - fees.organic;
  return {
    offer,
    cashAffiliate,
    cashVip,
    cashAi,
    cashHighTicket,
    totalCash: cashAffiliate + cashVip + cashAi + cashHighTicket,
    adSpend,
    salesTeamPayout: payout.paid + payout.organic,
    fees: fees.paid + fees.organic,
    expenses: offer === "bronson" ? expenses : 0,
    payablePaid,
    payableOrganic,
    payableShare: payablePaid + payableOrganic,
    // Aval's card shows the offer's whole 35% share, by the owner's choice
    // (this section is shared with the team). The Agency page keeps its own figure.
    agencyShare:
      offer === "bronson"
        ? bronsonAgencyProfit(rows)
        : offer === "aaron"
          ? aaronAgencyShare(rows)
          : AVAL_PAYOUTS_SHARE * (payablePaid + payableOrganic),
  };
}
