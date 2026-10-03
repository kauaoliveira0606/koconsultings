/**
 * Shared math for the personal Agency rollup (/agency) — the one place
 * that intentionally combines all three offers' data, to answer "what does
 * KOconsultings actually take home." Every individual offer dashboard
 * stays isolated to its own base; this is the deliberate aggregator.
 */
import { isDateInRange, type ResolvedRange } from "./date-range";
import { sumByDate } from "./metrics";

/** Data before this date is out of scope for the agency rollup entirely, per the client. */
export const AGENCY_DATA_START = "2026-09-01";

/** Andy (Ecom Simulation) stopped being a client after this day; nothing of his counts from October 2026 on. */
export const ANDY_LAST_DAY = "2026-09-30";

/** Drops everything dated after Andy's last day as a client. */
export function untilAndyLeft<T extends { date: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.date <= ANDY_LAST_DAY);
}

/** Aval moved from a revenue share to a profit split on this day: sales team commissions come off before the 11.5%. */
export const AVAL_PROFIT_SPLIT_FROM = "2026-10-01";

/** Last day there was a sales manager; no 5% cut on anything dated after it. */
export const SALES_MANAGER_LAST_DAY = "2026-09-30";

/** Sun/Sat get the 20% affiliate commission rate; Mon–Fri get 10%. Same rule every offer already uses. */
function isWeekendDate(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Sales team commission on a day's cash: 10%/20% weekday/weekend on Low Ticket, flat 15% on High Ticket. */
function commissionForDay(date: string, ltCash: number, htCash: number): number {
  return ltCash * (isWeekendDate(date) ? 0.2 : 0.1) + htCash * 0.15;
}

export type DailyOfferRow = {
  date: string;
  ltCashPaid: number;
  ltCashOrganic: number;
  htCashPaid: number;
  htCashOrganic: number;
  adSpend: number;
  /** Monthly tool expenses, booked in full on the 1st of their month. Bronson/Andy only. */
  expenses: number;
  /** Set when the offer's sales team payout is known rather than estimated from cash (Bronson, Aval's revenue-share days). */
  salesTeamPayout?: { paid: number; organic: number };
};

type MarketingRowLike = {
  date: string | null;
  cashCollectedLowTicket: number | null;
  cashCollectedLowTicketPaid: number | null;
  cashCollectedLowTicketOrganic: number | null;
  cashCollectedHighTicket: number | null;
  cashCollectedHighTicketPaid: number | null;
  cashCollectedHighTicketOrganic: number | null;
  adSpendMeta: number | null;
};

/**
 * Everything here comes straight from the Marketing Daily Metrics table —
 * no EOD Closer / Affiliate EOD blending, per the client. Different
 * offers' teams fill this form in differently: Bronson types an explicit
 * Paid figure AND an explicit Organic figure and never touches the Total
 * field; Aval/Ecom Simulation type the Total and only occasionally split
 * out Paid. Deriving Organic as (Total − Paid) — as this used to do —
 * silently zeroed out Bronson's real organic cash every single day,
 * since its Total was always blank.
 *
 * So Paid is trusted as typed, and Organic is whichever is bigger: the
 * explicit Organic figure, or (Total − Paid) — covering an offer that
 * only ever fills in Total. This way neither a missing Total nor a
 * missing explicit Organic field can make real cash disappear. Anything
 * before `AGENCY_DATA_START` is dropped entirely — August and earlier is
 * out of scope for this rollup.
 */
export function buildDailyOfferRows(
  marketing: MarketingRowLike[],
  expensesByMonth: Map<string, number> = new Map()
): DailyOfferRow[] {
  marketing = marketing.filter((r) => r.date !== null && r.date >= AGENCY_DATA_START);
  const ltTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicket);
  const ltPaidByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedLowTicketPaid);
  const ltOrganicByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedLowTicketOrganic
  );
  const htTotalByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedHighTicket);
  const htPaidByDay = sumByDate(marketing, (r) => r.date, (r) => r.cashCollectedHighTicketPaid);
  const htOrganicByDay = sumByDate(
    marketing,
    (r) => r.date,
    (r) => r.cashCollectedHighTicketOrganic
  );
  const adSpendByDay = sumByDate(marketing, (r) => r.date, (r) => r.adSpendMeta);

  // Monthly bills land in full on the 1st of their month, so any range that
  // covers that month (this month, all time, the calendar's day 1) carries
  // the whole bill.
  const expensesByDay = new Map<string, number>();
  for (const [month, total] of expensesByMonth) {
    const date = `${month}-01`;
    if (date >= AGENCY_DATA_START) expensesByDay.set(date, total);
  }

  const dates = new Set<string>([
    ...ltTotalByDay.keys(),
    ...ltPaidByDay.keys(),
    ...ltOrganicByDay.keys(),
    ...htTotalByDay.keys(),
    ...htPaidByDay.keys(),
    ...htOrganicByDay.keys(),
    ...adSpendByDay.keys(),
    ...expensesByDay.keys(),
  ]);

  const rows: DailyOfferRow[] = [];
  for (const date of dates) {
    const ltPaid = ltPaidByDay.get(date) ?? 0;
    const ltImpliedOrganic = Math.max(0, (ltTotalByDay.get(date) ?? 0) - ltPaid);
    const ltOrganic = Math.max(ltOrganicByDay.get(date) ?? 0, ltImpliedOrganic);
    const htPaid = htPaidByDay.get(date) ?? 0;
    const htImpliedOrganic = Math.max(0, (htTotalByDay.get(date) ?? 0) - htPaid);
    const htOrganic = Math.max(htOrganicByDay.get(date) ?? 0, htImpliedOrganic);
    rows.push({
      date,
      ltCashPaid: ltPaid,
      ltCashOrganic: ltOrganic,
      htCashPaid: htPaid,
      htCashOrganic: htOrganic,
      adSpend: adSpendByDay.get(date) ?? 0,
      expenses: expensesByDay.get(date) ?? 0,
    });
  }
  return rows;
}

export function cash(r: DailyOfferRow): number {
  return r.ltCashPaid + r.ltCashOrganic + r.htCashPaid + r.htCashOrganic;
}

export function sumCash(rows: DailyOfferRow[]): number {
  return rows.reduce((total, r) => total + cash(r), 0);
}

export function sumAdSpend(rows: DailyOfferRow[]): number {
  return rows.reduce((total, r) => total + r.adSpend, 0);
}

export function sumExpenses(rows: DailyOfferRow[]): number {
  return rows.reduce((total, r) => total + r.expenses, 0);
}

/** Total sales team commission, split by Paid vs Organic traffic. */
export function sumSalesTeamPayout(rows: DailyOfferRow[]): { paid: number; organic: number } {
  let paid = 0;
  let organic = 0;
  for (const r of rows) {
    paid += r.salesTeamPayout?.paid ?? commissionForDay(r.date, r.ltCashPaid, r.htCashPaid);
    organic +=
      r.salesTeamPayout?.organic ?? commissionForDay(r.date, r.ltCashOrganic, r.htCashOrganic);
  }
  return { paid, organic };
}

/**
 * Swaps logged low ticket cash for TRUE cash. The Marketing Daily Metrics
 * form logs what reps say they sold; the affiliate portal only pays what it
 * tracked. The portal doesn't know Paid from Organic and its dates don't line
 * up day for day with the form, so each calendar month's portal total is
 * spread over that month's logged days, keeping the logged paid / organic
 * proportions. A month the portal has nothing for yet is left as logged.
 */
export function withAttributedLowTicket(
  rows: DailyOfferRow[],
  portalCashByDay: Map<string, number>
): DailyOfferRow[] {
  const logged = new Map<string, number>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    logged.set(month, (logged.get(month) ?? 0) + r.ltCashPaid + r.ltCashOrganic);
  }
  const portal = new Map<string, number>();
  for (const [date, cash] of portalCashByDay) {
    if (date < AGENCY_DATA_START) continue;
    const month = date.slice(0, 7);
    portal.set(month, (portal.get(month) ?? 0) + cash);
  }
  return rows.map((r) => {
    const month = r.date.slice(0, 7);
    const loggedCash = logged.get(month) ?? 0;
    const portalCash = portal.get(month);
    if (portalCash === undefined || loggedCash <= 0) return r;
    const rate = portalCash / loggedCash;
    return { ...r, ltCashPaid: r.ltCashPaid * rate, ltCashOrganic: r.ltCashOrganic * rate };
  });
}

/** First day Bronson's sales team was paid by the Commissions tab's rules (Sep 16-30 pay period). */
export const BRONSON_ACTUAL_COMMISSIONS_FROM = "2026-09-16";

/**
 * Bronson is a profit share on PAID traffic only, so only paid-traffic
 * commissions come off — organic commissions are never deducted here. From
 * `BRONSON_ACTUAL_COMMISSIONS_FROM` the paid figure is the actual commission
 * from the Commissions tab (`paidByDay`); before that it stays the cash-based
 * estimate, since that period was paid out under the old rules.
 */
export function withBronsonActualCommissions(
  rows: DailyOfferRow[],
  paidByDay: Map<string, number>
): DailyOfferRow[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  for (const date of paidByDay.keys()) {
    if (date >= BRONSON_ACTUAL_COMMISSIONS_FROM && !byDate.has(date)) {
      byDate.set(date, {
        date,
        ltCashPaid: 0,
        ltCashOrganic: 0,
        htCashPaid: 0,
        htCashOrganic: 0,
        adSpend: 0,
        expenses: 0,
      });
    }
  }
  return Array.from(byDate.values()).map((r) => ({
    ...r,
    salesTeamPayout: {
      paid:
        r.date >= BRONSON_ACTUAL_COMMISSIONS_FROM
          ? (paidByDay.get(r.date) ?? 0)
          : commissionForDay(r.date, r.ltCashPaid, r.htCashPaid),
      organic: 0,
    },
  }));
}

/** Generic client P&L per day, same shape as every offer's own "Net Cash" stat. */
export function profitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const { paid, organic } = sumSalesTeamPayout([r]);
    map.set(r.date, cash(r) - r.adSpend - (paid + organic) - r.expenses);
  }
  return map;
}

export function profit(rows: DailyOfferRow[]): number {
  return sumMapValues(profitByDay(rows));
}

/** Bronson: 50% agency share of Paid profit (after ad spend + sales team + expenses), plus 20% of Organic top-line cash — per day. */
export function bronsonAgencyProfitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const cashPaid = r.ltCashPaid + r.htCashPaid;
    const cashOrganic = r.ltCashOrganic + r.htCashOrganic;
    const { paid: payoutPaid } = sumSalesTeamPayout([r]);
    const paidProfit = cashPaid - r.adSpend - payoutPaid - r.expenses;
    map.set(r.date, 0.5 * paidProfit + 0.2 * cashOrganic);
  }
  return map;
}

export function bronsonAgencyProfit(rows: DailyOfferRow[]): number {
  return sumMapValues(bronsonAgencyProfitByDay(rows));
}

/**
 * Aval was a straight revenue share before `AVAL_PROFIT_SPLIT_FROM`: nothing
 * came off for the sales team, so those days carry a zero payout. From that
 * day the payout is the usual cash-based commission (10%/20% weekday/weekend
 * on Low Ticket, 5% setter + 10% closer on High Ticket), paid and organic.
 */
export function withAvalProfitSplit(rows: DailyOfferRow[]): DailyOfferRow[] {
  return rows.map((r) =>
    r.date >= AVAL_PROFIT_SPLIT_FROM ? r : { ...r, salesTeamPayout: { paid: 0, organic: 0 } }
  );
}

/** Aval: 11.5% of (cash minus ad spend minus sales team) — no expenses — per day. Rows must come through `withAvalProfitSplit`. */
export function avalAgencyProfitByDay(rows: DailyOfferRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const { paid, organic } = sumSalesTeamPayout([r]);
    map.set(r.date, 0.115 * (cash(r) - r.adSpend - paid - organic));
  }
  return map;
}

export function avalAgencyProfit(rows: DailyOfferRow[]): number {
  return sumMapValues(avalAgencyProfitByDay(rows));
}

/**
 * Andy (Ecom Simulation): 17.5% organic / 22.5% paid, doubling to 35%/45%
 * once that CALENDAR MONTH's combined (organic + paid) cash crosses
 * $100k — the whole month's cash re-rates at the higher tier, not just the
 * amount above $100k. `allRows` must be unfiltered by date range (every
 * row this offer has ever logged) so a month's tier is judged on its full
 * total even when only a narrower slice of it is being summed.
 */
export function ecomSimAgencyProfitByDay(allRows: DailyOfferRow[]): Map<string, number> {
  const monthCash = new Map<string, number>();
  for (const r of allRows) {
    const month = r.date.slice(0, 7);
    monthCash.set(month, (monthCash.get(month) ?? 0) + cash(r));
  }

  const map = new Map<string, number>();
  for (const r of allRows) {
    const month = r.date.slice(0, 7);
    const tierHit = (monthCash.get(month) ?? 0) > 100_000;
    const rateOrganic = tierHit ? 0.35 : 0.175;
    const ratePaid = tierHit ? 0.45 : 0.225;
    const { paid: payoutPaid, organic: payoutOrganic } = sumSalesTeamPayout([r]);
    // Expenses split 50/50 between the organic and paid sides, per the client.
    const organicProfit = r.ltCashOrganic + r.htCashOrganic - payoutOrganic - r.expenses / 2;
    const paidProfit = r.ltCashPaid + r.htCashPaid - r.adSpend - payoutPaid - r.expenses / 2;
    map.set(r.date, rateOrganic * organicProfit + ratePaid * paidProfit);
  }
  return map;
}

/** `allRows` unfiltered (see above); only rows inside `range` are summed into the total. */
export function ecomSimAgencyProfit(allRows: DailyOfferRow[], range: ResolvedRange): number {
  let total = 0;
  for (const [date, value] of ecomSimAgencyProfitByDay(allRows)) {
    if (isDateInRange(date, range)) total += value;
  }
  return total;
}

/**
 * Sales manager's 5% cut, paid out of the agency owner's own split — per
 * day. Mirrors each offer's own profit-share basis: Bronson's organic leg
 * is on top-line organic cash, Andy's is on organic profit (after sales
 * team); the paid leg is on paid profit (after ad spend + sales team) for
 * both. Expenses come off the same way as in each offer's own split:
 * Bronson all off paid, Andy 50/50. No cut on Aval, and none on anything
 * dated after `SALES_MANAGER_LAST_DAY`.
 */
function salesManagerCutByDay(
  rows: DailyOfferRow[],
  organicBasis: "cash" | "profit"
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.date > SALES_MANAGER_LAST_DAY) continue;
    const { paid: payoutPaid, organic: payoutOrganic } = sumSalesTeamPayout([r]);
    const cashOrganic = r.ltCashOrganic + r.htCashOrganic;
    const organicBase =
      organicBasis === "cash" ? cashOrganic : cashOrganic - payoutOrganic - r.expenses / 2;
    const paidExpenses = organicBasis === "cash" ? r.expenses : r.expenses / 2;
    const paidProfit = r.ltCashPaid + r.htCashPaid - r.adSpend - payoutPaid - paidExpenses;
    map.set(r.date, 0.05 * organicBase + 0.05 * paidProfit);
  }
  return map;
}

export function bronsonSalesManagerCutByDay(rows: DailyOfferRow[]): Map<string, number> {
  return salesManagerCutByDay(rows, "cash");
}

export function ecomSimSalesManagerCutByDay(rows: DailyOfferRow[]): Map<string, number> {
  return salesManagerCutByDay(rows, "profit");
}

export function bronsonSalesManagerCut(rows: DailyOfferRow[]): number {
  return sumMapValues(bronsonSalesManagerCutByDay(rows));
}

export function ecomSimSalesManagerCut(rows: DailyOfferRow[]): number {
  return sumMapValues(ecomSimSalesManagerCutByDay(rows));
}

function sumMapValues(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}
