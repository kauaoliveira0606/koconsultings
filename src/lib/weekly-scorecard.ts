import type { StatFormat } from "./format";
import type {
  BronsonAffiliateEodRow,
  BronsonEodCloserRow,
  ConnectedCallRow,
  LeadRow,
  MarketingDailyMetricRow,
} from "./airtable/tables";
import { computeAttributionBuckets } from "./attribution";
import { isOrganicSource, isPaidSource } from "./airtable/lead-source-lookup";
import { easternDateString, toEasternDateOnly } from "./date-range";
import { average, roas, safeDivide, sum, vslTotals } from "./metrics";
import type { getGoals } from "./goals";

export type CellStatus = "green" | "yellow" | "red" | null;
export type GoalDirection = "higher" | "lower";

export type ScorecardCell = {
  date: string;
  value: number | null;
  status: CellStatus;
};

export type ScorecardRow = {
  key: string;
  label: string;
  format: StatFormat;
  goal: number | null;
  goalDirection: GoalDirection | null;
  /** Cash-collected rows are highlighted orange in the grid. */
  cash: boolean;
  days: ScorecardCell[];
  week: { value: number | null; status: CellStatus };
};

export type ScorecardGroup = {
  emoji: string;
  title: string;
  rows: ScorecardRow[];
};

export type WeeklyScorecardPayload = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  dayDates: string[];
  isCurrentWeek: boolean;
  groups: ScorecardGroup[];
};

/** ISO date math done in UTC so DST never shifts a day. */
export function isoAddDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): string {
  return easternDateString(now);
}

/** The Sunday on or before `iso` — weeks run Sunday → Saturday here. */
export function sundayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return isoAddDays(iso, -dow);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => isoAddDays(weekStart, i));
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T00:00:00Z`);
  const e = new Date(`${weekEnd}T00:00:00Z`);
  const month = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  const year = e.getUTCFullYear();
  return sameMonth
    ? `${month(s)} ${s.getUTCDate()} – ${e.getUTCDate()}, ${year}`
    : `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}, ${year}`;
}

export function cellStatus(
  actual: number | null,
  goal: number | null,
  direction: GoalDirection | null,
): CellStatus {
  if (actual === null || goal === null || direction === null || !Number.isFinite(actual)) {
    return null;
  }
  if (direction === "higher") {
    if (actual >= goal) return "green";
    if (actual >= goal * 0.8) return "yellow";
    return "red";
  }
  if (actual <= goal) return "green";
  if (actual <= goal * 1.2) return "yellow";
  return "red";
}

/** Affiliate EOD, summed across all setter rows for one day. */
type EodDay = {
  dials: number | null;
  pickups: number | null;
  pitched: number | null;
  closed: number | null;
  cashLowTicket: number | null;
  // high ticket — the setters log this on their Affiliate EOD
  htBooked: number | null;
  htShowed: number | null;
  htClosed: number | null;
  htCash: number | null;
  newHtBooked: number | null;
};

/** EOD Closer, summed across all closer rows for one day (legacy fallback). */
type CloserDay = {
  callsBooked: number | null;
  callsShowed: number | null;
  dealsClosed: number | null;
  cashHighTicket: number | null;
};

/**
 * Everything a single day's cell needs. The Marketing Daily Metrics form is
 * the source of truth for every metric it tracks (sales, dials, high-ticket
 * calls/closes, cash, ad spend, and the rates the team types in: CPL,
 * opt-in, funnel conversion, close and connection rate); everything else
 * (EOD roll-ups, Leads table, VTurb, calculated rates) only fills a day
 * the form left blank, plus what only they track (pitched, pickups).
 */
type DayCtx = {
  date: string;
  m?: MarketingDailyMetricRow;
  eod?: EodDay;
  closer?: CloserDay;
  paidLeads: number;
  organicLeads: number;
  /** Affiliate PCN closes logged that day, and how many were Yearly plans. */
  pcnTotal: number;
  pcnYearly: number;
  /** Connected (1+ min) calls by lead tag; null before tag tracking started. */
  connectedPaid: number | null;
  connectedOrganic: number | null;
};

/**
 * Optional per-offer inputs for rows that live outside the shared form/EOD
 * tables. Any piece left out just renders that row blank.
 */
export type ScorecardExtras = {
  pcn?: { date: string | null; plan: string | null }[];
  connected?: ConnectedCallRow[];
  connectionTrackingStart?: string;
  attribution?: {
    portal: {
      date: string | null;
      brand: string | null;
      purchases: number | null;
    }[];
    pcn: {
      date: string | null;
      brand?: string | null;
      software?: string | null;
    }[];
    brands: string[];
    dataFloor: string;
  };
};

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v;

// --- per-day component accessors (form first, EOD fallback) ---
const dAdSpend = (c: DayCtx) => (c.m ? num(c.m.adSpendMeta) : null);
const dSalesLT = (c: DayCtx) =>
  (c.m ? num(c.m.salesLowTicket) : null) ?? (c.eod ? num(c.eod.closed) : null);
const dPitched = (c: DayCtx) => (c.eod ? num(c.eod.pitched) : null);
// Affiliate close rate stays inside the EOD (closed and pitched both from
// the same setter reports) so the two sides always describe the same calls.
const dEodClosed = (c: DayCtx) => (c.eod ? num(c.eod.closed) : null);
const dPickups = (c: DayCtx) => (c.eod ? num(c.eod.pickups) : null);
const dDials = (c: DayCtx) => (c.m ? num(c.m.dials) : null) ?? (c.eod ? num(c.eod.dials) : null);
// Cash Collected comes exclusively from the Marketing Daily Metrics form,
// per the client — no blending in Affiliate EOD or EOD Closer even though
// those tables also log a cash figure.
const dCashLT = (c: DayCtx) => (c.m ? num(c.m.cashCollectedLowTicket) : null);
const dCashHT = (c: DayCtx) => (c.m ? num(c.m.cashCollectedHighTicket) : null);
const dTotalCash = (c: DayCtx) => {
  const lt = dCashLT(c);
  const ht = dCashHT(c);
  if (lt === null && ht === null) return null;
  return (lt ?? 0) + (ht ?? 0);
};
/**
 * Effective Paid/Organic opt-in count for the day. The Leads table is the
 * live source going forward, but it's only been tracking since the switch —
 * on any day it has nothing, fall back to the Marketing Daily Metrics
 * form's "Opt ins (Paid/Organic)" count, which is what was tracked before.
 */
const dPaidLeads = (c: DayCtx): number | null => {
  if (c.paidLeads > 0) return c.paidLeads;
  if (c.m) return c.m.optInsPaid ?? 0;
  return null;
};
const dOrganicLeads = (c: DayCtx): number | null => {
  if (c.organicLeads > 0) return c.organicLeads;
  if (c.m) return c.m.optInsOrganic ?? 0;
  return null;
};
const dLeads = (c: DayCtx) => (dPaidLeads(c) ?? 0) + (dOrganicLeads(c) ?? 0);

// --- paid / organic splits (Marketing Daily Metrics form only) ---
const dSalesLTPaid = (c: DayCtx) => (c.m ? num(c.m.salesLowTicketPaid) : null);
const dSalesLTOrg = (c: DayCtx) => (c.m ? num(c.m.salesLowTicketOrganic) : null);
const dCashLTPaid = (c: DayCtx) => (c.m ? num(c.m.cashCollectedLowTicketPaid) : null);
const dCashLTOrg = (c: DayCtx) => (c.m ? num(c.m.cashCollectedLowTicketOrganic) : null);
const dCashHTPaid = (c: DayCtx) => (c.m ? num(c.m.cashCollectedHighTicketPaid) : null);
const dCashHTOrg = (c: DayCtx) => (c.m ? num(c.m.cashCollectedHighTicketOrganic) : null);

// --- high-ticket: form first, then EOD Closer, then Affiliate EOD (same
// order as the Overview cards) ---
const firstOf = (...vals: (number | null | undefined)[]) => {
  for (const v of vals) if (num(v) !== null) return v as number;
  return null;
};
const dHtBooked = (c: DayCtx) => firstOf(c.m?.callsBooked, c.closer?.callsBooked, c.eod?.htBooked);
const dHtShowed = (c: DayCtx) => firstOf(c.m?.callsShowed, c.closer?.callsShowed, c.eod?.htShowed);
const dHtClosed = (c: DayCtx) =>
  firstOf(c.m?.highTicketDealsClosed, c.closer?.dealsClosed, c.eod?.htClosed);

const dNewHtBooked = (c: DayCtx) => (c.eod ? num(c.eod.newHtBooked) : null);
const dRevenueHT = (c: DayCtx) => (c.m ? num(c.m.revenueHighTicket) : null);
const dHtClosedPaid = (c: DayCtx) => (c.m ? num(c.m.highTicketDealsClosedPaid) : null);
const dRefundCb = (c: DayCtx) => {
  if (!c.m) return null;
  const r = num(c.m.refundDollars);
  const cb = num(c.m.chargebackDollars);
  if (r === null && cb === null) return null;
  return (r ?? 0) + (cb ?? 0);
};
// Paid-only ratios over ad spend stay blank on $0 days, same as the
// Overview's "Not Active".
const dSpendOrNull = (c: DayCtx) => dAdSpend(c) || null;
const wSpendOrNull = (days: DayCtx[]) => sum(days.map(dAdSpend)) || null;
const sumLeads = (days: DayCtx[], pick: (c: DayCtx) => number | null) =>
  days.reduce((n, c) => n + (pick(c) ?? 0), 0) || null;
const pcnDays = (days: DayCtx[]) => days.filter((c) => c.pcnTotal > 0);
// Connection rate by source only counts days after the tags existed.
const dConnRate =
  (connected: (c: DayCtx) => number | null, leads: (c: DayCtx) => number) => (c: DayCtx) =>
    connected(c) === null ? null : safeDivide(connected(c), leads(c) || null);
const wConnRate =
  (connected: (c: DayCtx) => number | null, leads: (c: DayCtx) => number) => (days: DayCtx[]) => {
    const tracked = days.filter((c) => connected(c) !== null);
    if (tracked.length === 0) return null;
    return safeDivide(
      sum(tracked.map(connected)),
      tracked.reduce((n, c) => n + leads(c), 0) || null,
    );
  };

const wSum = (pick: (c: DayCtx) => number | null) => (days: DayCtx[]) => sum(days.map(pick));
const wAvg = (pick: (c: DayCtx) => number | null) => (days: DayCtx[]) => average(days.map(pick));

type MetricSpec = {
  key: string;
  label: string;
  format: StatFormat;
  goal: number | null;
  goalDirection: GoalDirection | null;
  day: (c: DayCtx) => number | null;
  week: (days: DayCtx[]) => number | null;
};

function buildSpecs(
  goals: Awaited<ReturnType<typeof getGoals>>,
  weekAttribution: number | null,
): {
  emoji: string;
  title: string;
  metrics: MetricSpec[];
}[] {
  const fromM = (pick: (r: MarketingDailyMetricRow) => number | null) => (c: DayCtx) =>
    c.m ? num(pick(c.m)) : null;

  return [
    {
      emoji: "💰",
      title: "Leading Metrics",
      metrics: [
        {
          key: "adSpendMeta",
          label: "Ad Spend Meta",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dAdSpend,
          week: wSum(dAdSpend),
        },
        {
          key: "costPerLeadMeta",
          label: "Cost Per Lead (Meta)",
          format: "currency",
          goal: goals.costPerLeadMeta?.max ?? null,
          goalDirection: "lower",
          // Paid-lead count: Leads table, falling back to the Marketing
          // Daily Metrics "Opt ins (Paid)" count on days it has nothing.
          // Form's typed CPL first; calculated only on days it's blank.
          day: (c) =>
            (c.m ? num(c.m.costPerLeadMeta) : null) ??
            safeDivide(dAdSpend(c), dPaidLeads(c) || null),
          week: (days) =>
            safeDivide(
              sum(days.map(dAdSpend)),
              days.reduce((n, c) => n + (dPaidLeads(c) ?? 0), 0) || null,
            ),
        },
        {
          key: "cashCollectedLowTicket",
          label: "Cash Collected – Low Ticket",
          format: "currency",
          goal: goals.cashCollectedLowTicket,
          goalDirection: goals.cashCollectedLowTicket === null ? null : "higher",
          day: dCashLT,
          week: wSum(dCashLT),
        },
        {
          key: "cashLtPaid",
          label: "↳ Cash LT (Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashLTPaid,
          week: wSum(dCashLTPaid),
        },
        {
          key: "cashLtOrganic",
          label: "↳ Cash LT (Organic)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashLTOrg,
          week: wSum(dCashLTOrg),
        },
        {
          key: "cashCollectedHighTicket",
          label: "Cash Collected – High Ticket",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashHT,
          week: wSum(dCashHT),
        },
        {
          key: "cashHtPaid",
          label: "↳ Cash HT (Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashHTPaid,
          week: wSum(dCashHTPaid),
        },
        {
          key: "cashHtOrganic",
          label: "↳ Cash HT (Organic)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashHTOrg,
          week: wSum(dCashHTOrg),
        },
        {
          key: "funnelConvPaid",
          label: "Funnel Conversion Rate (Paid)",
          format: "percent",
          goal: goals.funnelConversionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) =>
            (c.m ? num(c.m.funnelConversionRatePaid) : null) ??
            safeDivide(dSalesLTPaid(c), dPaidLeads(c) || null),
          week: (days) =>
            safeDivide(
              sum(days.map(dSalesLTPaid)),
              days.reduce((n, c) => n + (dPaidLeads(c) ?? 0), 0) || null,
            ),
        },
        {
          key: "funnelConvOrganic",
          label: "Funnel Conversion Rate (Organic)",
          format: "percent",
          goal: goals.funnelConversionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) =>
            (c.m ? num(c.m.funnelConversionRateOrganic) : null) ??
            safeDivide(dSalesLTOrg(c), dOrganicLeads(c) || null),
          week: (days) =>
            safeDivide(
              sum(days.map(dSalesLTOrg)),
              days.reduce((n, c) => n + (dOrganicLeads(c) ?? 0), 0) || null,
            ),
        },
        {
          key: "roasTotal",
          label: "ROAS (Paid Cash ÷ Ad Spend)",
          format: "ratio",
          goal: goals.roasTotal?.min ?? null,
          goalDirection: "higher",
          day: (c) => roas(dCashLTPaid(c), dAdSpend(c)),
          week: (days) => roas(sum(days.map(dCashLTPaid)), sum(days.map(dAdSpend))),
        },
        {
          key: "cpaLowTicket",
          label: "CPA – Low Ticket (Paid)",
          format: "currency",
          goal: goals.cpaLowTicket?.max ?? null,
          goalDirection: "lower",
          day: (c) => safeDivide(dAdSpend(c), dSalesLTPaid(c)),
          week: (days) => safeDivide(sum(days.map(dAdSpend)), sum(days.map(dSalesLTPaid))),
        },
        {
          key: "cacHighTicketPaid",
          label: "CAC – High Ticket (Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dSpendOrNull(c), dHtClosedPaid(c) || null),
          week: (days) => safeDivide(wSpendOrNull(days), sum(days.map(dHtClosedPaid)) || null),
        },
        {
          key: "costPerCallHT",
          label: "Cost Per Call (HT)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dSpendOrNull(c), dHtBooked(c) || null),
          week: (days) => safeDivide(wSpendOrNull(days), sum(days.map(dHtBooked)) || null),
        },
        {
          key: "cashPerOptInPaid",
          label: "Cash Collected / Opt-In (Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dCashLTPaid(c), dPaidLeads(c) || null),
          week: (days) => safeDivide(sum(days.map(dCashLTPaid)), sumLeads(days, dPaidLeads)),
        },
        {
          key: "collectedPerBookedCallHT",
          label: "Collected $ / Booked Call (HT)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dCashHT(c), dHtBooked(c) || null),
          week: (days) => safeDivide(sum(days.map(dCashHT)), sum(days.map(dHtBooked)) || null),
        },
        {
          key: "totalCashCollected",
          label: "Total Cash Collected",
          format: "currency",
          goal: goals.totalCashCollected,
          goalDirection: goals.totalCashCollected === null ? null : "higher",
          day: dTotalCash,
          week: wSum(dTotalCash),
        },
      ],
    },
    {
      emoji: "🔥",
      title: "Lead Flow",
      metrics: [
        {
          key: "optInsPaid",
          label: "Opt-Ins (Paid)",
          format: "number",
          goal: goals.optInsPaid,
          goalDirection: goals.optInsPaid === null ? null : "higher",
          day: dPaidLeads,
          week: (days) => days.reduce((n, c) => n + (dPaidLeads(c) ?? 0), 0),
        },
        {
          key: "optInsOrganic",
          label: "Opt-Ins (Organic)",
          format: "number",
          goal: goals.optInsOrganic,
          goalDirection: goals.optInsOrganic === null ? null : "higher",
          day: dOrganicLeads,
          week: (days) => days.reduce((n, c) => n + (dOrganicLeads(c) ?? 0), 0),
        },
        {
          key: "vslViews",
          label: "VSL Views",
          format: "number",
          goal: goals.vslViews,
          goalDirection: goals.vslViews === null ? null : "higher",
          day: fromM((r) => r.vslViews),
          week: wSum(fromM((r) => r.vslViews)),
        },
      ],
    },
    {
      emoji: "🤝",
      title: "Sales Conversion",
      metrics: [
        {
          key: "dials",
          label: "Dials",
          format: "number",
          goal: goals.dials,
          goalDirection: goals.dials === null ? null : "higher",
          day: dDials,
          week: wSum(dDials),
        },
        {
          key: "pickups",
          label: "Pickups",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dPickups,
          week: wSum(dPickups),
        },
        {
          key: "pickupRate",
          label: "Pickup Rate (Pickups ÷ Dials)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dPickups(c), dDials(c) || null),
          week: (days) => safeDivide(sum(days.map(dPickups)), sum(days.map(dDials)) || null),
        },
        {
          key: "softwarePitched",
          label: "Software Pitched",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dPitched,
          week: wSum(dPitched),
        },
        {
          key: "pitchRate",
          label: "Pitch Rate (Pitched ÷ Pickups)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dPitched(c), dPickups(c) || null),
          week: (days) => safeDivide(sum(days.map(dPitched)), sum(days.map(dPickups)) || null),
        },
        {
          key: "salesLowTicket",
          label: "Sales – Low Ticket",
          format: "number",
          goal: goals.salesLowTicket,
          goalDirection: goals.salesLowTicket === null ? null : "higher",
          day: dSalesLT,
          week: wSum(dSalesLT),
        },
        {
          key: "salesLtPaid",
          label: "↳ Sales LT (Paid)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dSalesLTPaid,
          week: wSum(dSalesLTPaid),
        },
        {
          key: "salesLtOrganic",
          label: "↳ Sales LT (Organic)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dSalesLTOrg,
          week: wSum(dSalesLTOrg),
        },
        {
          key: "closeRateLowTicket",
          label: "Close Rate – Affiliate",
          format: "percent",
          goal: goals.closeRateLowTicket?.min ?? null,
          goalDirection: "higher",
          // Affiliate EOD "software closed" ÷ "software pitched", always —
          // form value only when a day has no Affiliate EOD submission.
          day: (c) =>
            (c.m ? num(c.m.closeRateLowTicket) : null) ?? safeDivide(dEodClosed(c), dPitched(c)),
          week: (days) => safeDivide(sum(days.map(dEodClosed)), sum(days.map(dPitched))),
        },
        {
          key: "aovLowTicket",
          label: "AOV – Low Ticket",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dCashLT(c), dSalesLT(c) || null),
          week: (days) => safeDivide(sum(days.map(dCashLT)), sum(days.map(dSalesLT)) || null),
        },
        {
          key: "leadToCloseRate",
          label: "Lead-to-Close Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dSalesLT(c), dLeads(c) || null),
          week: (days) =>
            safeDivide(sum(days.map(dSalesLT)), days.reduce((n, c) => n + dLeads(c), 0) || null),
        },
        {
          key: "yearlyShare",
          label: "Yearly Split % (Affiliate PCN)",
          format: "percent",
          goal: goals.yearlyShare?.min ?? null,
          goalDirection: "higher",
          day: (c) => (c.pcnTotal > 0 ? c.pcnYearly / c.pcnTotal : null),
          week: (days) => {
            const d = pcnDays(days);
            const total = d.reduce((n, c) => n + c.pcnTotal, 0);
            return total > 0 ? d.reduce((n, c) => n + c.pcnYearly, 0) / total : null;
          },
        },
      ],
    },
    {
      emoji: "🎯",
      title: "High Ticket",
      metrics: [
        {
          key: "htCallsBooked",
          label: "Calls Booked (Calendar)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dHtBooked,
          week: wSum(dHtBooked),
        },
        {
          key: "htCallsShowed",
          label: "Calls Showed",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dHtShowed,
          week: wSum(dHtShowed),
        },
        {
          key: "htShowRate",
          label: "Show Rate",
          format: "percent",
          goal: goals.showRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => safeDivide(dHtShowed(c), dHtBooked(c)),
          week: (days) => safeDivide(sum(days.map(dHtShowed)), sum(days.map(dHtBooked))),
        },
        {
          key: "htDealsClosed",
          label: "High Ticket Deals Closed",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dHtClosed,
          week: wSum(dHtClosed),
        },
        {
          key: "htCloseRate",
          label: "High Ticket Close Rate",
          format: "percent",
          goal: goals.highTicketCloseRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => safeDivide(dHtClosed(c), dHtShowed(c)),
          week: (days) => safeDivide(sum(days.map(dHtClosed)), sum(days.map(dHtShowed))),
        },
        {
          key: "htBookingRateFromLt",
          label: "HT Booking Rate (from LT)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dNewHtBooked(c), dSalesLT(c) || null),
          week: (days) => safeDivide(sum(days.map(dNewHtBooked)), sum(days.map(dSalesLT)) || null),
        },
        {
          key: "aovHighTicket",
          label: "AOV – High Ticket",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dCashHT(c), dHtClosed(c) || null),
          week: (days) => safeDivide(sum(days.map(dCashHT)), sum(days.map(dHtClosed)) || null),
        },
        {
          key: "revenueHighTicket",
          label: "Revenue – High Ticket",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dRevenueHT,
          week: wSum(dRevenueHT),
        },
      ],
    },
    {
      emoji: "🚩",
      title: "Marketing Metrics",
      metrics: [
        {
          key: "landingPageConnectRate",
          label: "Landing Page Connect Rate",
          format: "percent",
          goal: goals.landingPageConnectRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.landingPageConnectRate),
          week: wAvg(fromM((r) => r.landingPageConnectRate)),
        },
        {
          key: "optInRate",
          label: "Opt-In Rate (Paid)",
          format: "percent",
          goal: goals.optInRate?.min ?? null,
          goalDirection: "higher",
          // Paid-lead count: Leads table, falling back to the Marketing
          // Daily Metrics "Opt ins (Paid)" count. VSL Views has no other
          // source, so it's still the form value.
          day: (c) =>
            (c.m ? num(c.m.optInRate) : null) ??
            safeDivide(dPaidLeads(c), (c.m ? num(c.m.vslViews) : null) || null),
          // Only days with VSL views count, so pre-VSL days can't inflate it.
          week: (days) => {
            const vslDays = days.filter((c) => (c.m ? (num(c.m.vslViews) ?? 0) : 0) > 0);
            return safeDivide(
              vslDays.reduce((n, c) => n + (dPaidLeads(c) ?? 0), 0),
              sum(vslDays.map(fromM((r) => r.vslViews))),
            );
          },
        },
        {
          key: "vslPlayRate",
          label: "VSL Play Rate (Paid)",
          format: "percent",
          goal: goals.vslPlayRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslPlayRate),
          // Weighted by views, same as the Overview card.
          week: (days) => vslTotals(days.flatMap((c) => (c.m ? [c.m] : []))).vslPlayRate,
        },
        {
          key: "vslEngagementRate",
          label: "VSL Engagement Rate (Paid)",
          format: "percent",
          goal: goals.vslEngagementRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslEngagementRate),
          // Weighted by plays, same as the Overview card.
          week: (days) => vslTotals(days.flatMap((c) => (c.m ? [c.m] : []))).vslEngagementRate,
        },
      ],
    },
    {
      emoji: "📊",
      title: "Backend",
      metrics: [
        {
          key: "connectionRate",
          label: "Connection Rate (Pickups vs Opt-Ins)",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) =>
            (c.m ? num(c.m.connectionRate) : null) ?? safeDivide(dPickups(c), dLeads(c) || null),
          week: (days) =>
            safeDivide(sum(days.map(dPickups)), days.reduce((n, c) => n + dLeads(c), 0) || null),
        },
        {
          key: "connectionRatePaid",
          label: "↳ Connection Rate (Paid)",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: dConnRate(
            (c) => c.connectedPaid,
            (c) => c.paidLeads,
          ),
          week: wConnRate(
            (c) => c.connectedPaid,
            (c) => c.paidLeads,
          ),
        },
        {
          key: "connectionRateOrganic",
          label: "↳ Connection Rate (Organic)",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: dConnRate(
            (c) => c.connectedOrganic,
            (c) => c.organicLeads,
          ),
          week: wConnRate(
            (c) => c.connectedOrganic,
            (c) => c.organicLeads,
          ),
        },
        {
          key: "attributionRate",
          label: "Attribution Rate (week only)",
          format: "percent",
          goal: goals.attributionRate?.min ?? null,
          goalDirection: "higher",
          // Portal purchases land on their own schedule, so a single day
          // isn't meaningful; only the week total is scored.
          day: () => null,
          week: () => weekAttribution,
        },
        {
          key: "refundChargebackDollars",
          label: "Refund + Chargeback $",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dRefundCb,
          week: wSum(dRefundCb),
        },
        {
          key: "refundChargebackRate",
          label: "Refund / Chargeback Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => safeDivide(dRefundCb(c), dTotalCash(c) || null),
          week: (days) => safeDivide(sum(days.map(dRefundCb)), sum(days.map(dTotalCash)) || null),
        },
      ],
    },
  ];
}

/**
 * Display order, mirroring the Overview dashboard's tiers, with a Hierarchy
 * section on top for the numbers checked first. Metric definitions live in
 * buildSpecs; this only decides where each one shows up.
 */
const SCORECARD_LAYOUT: { emoji: string; title: string; keys: string[] }[] = [
  {
    emoji: "👑",
    title: "Hierarchy",
    keys: [
      "adSpendMeta",
      "costPerLeadMeta",
      "totalCashCollected",
      "cashCollectedLowTicket",
      "cashLtPaid",
      "cashLtOrganic",
      "cashCollectedHighTicket",
      "cashHtPaid",
      "cashHtOrganic",
      "roasTotal",
      "cpaLowTicket",
    ],
  },
  {
    emoji: "🔥",
    title: "Lead Flow",
    keys: ["optInsPaid", "optInsOrganic", "vslViews", "optInRate"],
  },
  {
    emoji: "🤝",
    title: "Front-End Sales Conversion",
    keys: [
      "dials",
      "pickups",
      "pickupRate",
      "softwarePitched",
      "pitchRate",
      "salesLowTicket",
      "salesLtPaid",
      "salesLtOrganic",
      "closeRateLowTicket",
      "aovLowTicket",
      "connectionRate",
      "connectionRatePaid",
      "connectionRateOrganic",
    ],
  },
  {
    emoji: "🎯",
    title: "High-Ticket Backend",
    keys: [
      "htCallsBooked",
      "htCallsShowed",
      "htShowRate",
      "htDealsClosed",
      "htCloseRate",
      "htBookingRateFromLt",
      "aovHighTicket",
      "revenueHighTicket",
    ],
  },
  {
    emoji: "💰",
    title: "Unit Economics",
    keys: [
      "cacHighTicketPaid",
      "costPerCallHT",
      "leadToCloseRate",
      "cashPerOptInPaid",
      "collectedPerBookedCallHT",
    ],
  },
  {
    emoji: "🚩",
    title: "Funnel & Marketing Health",
    keys: [
      "landingPageConnectRate",
      "vslPlayRate",
      "vslEngagementRate",
      "funnelConvPaid",
      "funnelConvOrganic",
    ],
  },
  {
    emoji: "📊",
    title: "Attribution & Refunds",
    keys: ["attributionRate", "yearlyShare", "refundChargebackDollars", "refundChargebackRate"],
  },
];

const CASH_KEYS = new Set([
  "totalCashCollected",
  "cashCollectedLowTicket",
  "cashLtPaid",
  "cashLtOrganic",
  "cashCollectedHighTicket",
  "cashHtPaid",
  "cashHtOrganic",
  "cashPerOptInPaid",
  "collectedPerBookedCallHT",
]);

const emptyDay = (date: string): DayCtx => ({
  date,
  paidLeads: 0,
  organicLeads: 0,
  pcnTotal: 0,
  pcnYearly: 0,
  connectedPaid: null,
  connectedOrganic: null,
});

/** Rolls every source up per Eastern day; returns a lookup for one day's inputs. */
function indexDays(
  allMarketing: MarketingDailyMetricRow[],
  allLeads: LeadRow[],
  allEod: BronsonAffiliateEodRow[],
  allCloser: BronsonEodCloserRow[],
  extras: ScorecardExtras
): (date: string) => DayCtx {
  const byDate = new Map(allMarketing.filter((r) => r.date).map((r) => [r.date as string, r]));

  // Affiliate EOD is per-setter — roll every setter's row up per day.
  const eodByDate = new Map<string, EodDay>();
  for (const r of allEod) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    const cur = eodByDate.get(d) ?? {
      dials: null,
      pickups: null,
      pitched: null,
      closed: null,
      cashLowTicket: null,
      htBooked: null,
      htShowed: null,
      htClosed: null,
      htCash: null,
      newHtBooked: null,
    };
    const add = (a: number | null, b: number | null) =>
      a === null && b === null ? null : (a ?? 0) + (b ?? 0);
    eodByDate.set(d, {
      dials: add(cur.dials, num(r.outboundDials)),
      pickups: add(cur.pickups, num(r.pickups)),
      pitched: add(cur.pitched, num(r.softwarePitched)),
      closed: add(cur.closed, num(r.softwareClosed)),
      cashLowTicket: add(cur.cashLowTicket, num(r.cashCollectedAffiliate)),
      htBooked: add(cur.htBooked, num(r.highTicketCallsOnCalendar)),
      htShowed: add(cur.htShowed, num(r.highTicketCallsShowed)),
      htClosed: add(cur.htClosed, num(r.highTicketSetClosed)),
      htCash: add(cur.htCash, num(r.cashCollectedHighTicket)),
      newHtBooked: add(cur.newHtBooked, num(r.newHighTicketCallsBooked)),
    });
  }

  // EOD Closer is per-closer too — roll high-ticket activity up per day.
  const closerByDate = new Map<string, CloserDay>();
  for (const r of allCloser) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    const cur = closerByDate.get(d) ?? {
      callsBooked: null,
      callsShowed: null,
      dealsClosed: null,
      cashHighTicket: null,
    };
    const add = (a: number | null, b: number | null) =>
      a === null && b === null ? null : (a ?? 0) + (b ?? 0);
    closerByDate.set(d, {
      callsBooked: add(cur.callsBooked, num(r.callsBooked)),
      callsShowed: add(cur.callsShowed, num(r.callsShowed)),
      dealsClosed: add(cur.dealsClosed, num(r.dealsClosed)),
      cashHighTicket: add(cur.cashHighTicket, num(r.cashCollectedHighTicket)),
    });
  }

  const paidByDate = new Map<string, number>();
  const organicByDate = new Map<string, number>();
  for (const lead of allLeads) {
    const d = toEasternDateOnly(lead.createdAt);
    if (!d) continue;
    if (isPaidSource(lead.source)) paidByDate.set(d, (paidByDate.get(d) ?? 0) + 1);
    else if (isOrganicSource(lead.source)) organicByDate.set(d, (organicByDate.get(d) ?? 0) + 1);
  }

  const pcnTotalByDate = new Map<string, number>();
  const pcnYearlyByDate = new Map<string, number>();
  for (const r of extras.pcn ?? []) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    pcnTotalByDate.set(d, (pcnTotalByDate.get(d) ?? 0) + 1);
    if ((r.plan ?? "").trim().toLowerCase() === "yearly") {
      pcnYearlyByDate.set(d, (pcnYearlyByDate.get(d) ?? 0) + 1);
    }
  }

  // One Connected Calls row per lead per day, so a row count is distinct leads.
  const connPaidByDate = new Map<string, number>();
  const connOrgByDate = new Map<string, number>();
  for (const c of extras.connected ?? []) {
    const d = toEasternDateOnly(c.date);
    if (!d) continue;
    if (isPaidSource(c.source)) connPaidByDate.set(d, (connPaidByDate.get(d) ?? 0) + 1);
    else if (isOrganicSource(c.source)) connOrgByDate.set(d, (connOrgByDate.get(d) ?? 0) + 1);
  }
  const connTracked = (date: string) =>
    !!extras.connected &&
    !!extras.connectionTrackingStart &&
    date >= extras.connectionTrackingStart;

  return (date) => ({
    date,
    m: byDate.get(date),
    eod: eodByDate.get(date),
    closer: closerByDate.get(date),
    paidLeads: paidByDate.get(date) ?? 0,
    organicLeads: organicByDate.get(date) ?? 0,
    pcnTotal: pcnTotalByDate.get(date) ?? 0,
    pcnYearly: pcnYearlyByDate.get(date) ?? 0,
    connectedPaid: connTracked(date) ? (connPaidByDate.get(date) ?? 0) : null,
    connectedOrganic: connTracked(date) ? (connOrgByDate.get(date) ?? 0) : null,
  });
}

export async function buildWeeklyScorecard(
  allMarketing: MarketingDailyMetricRow[],
  allLeads: LeadRow[],
  allEod: BronsonAffiliateEodRow[],
  allCloser: BronsonEodCloserRow[],
  weekStartInput: string | null,
  now: Date = new Date(),
  goals: Awaited<ReturnType<typeof getGoals>>,
  extras: ScorecardExtras = {},
): Promise<WeeklyScorecardPayload> {
  const currentWeekStart = sundayOf(todayIso(now));
  const weekStart = weekStartInput ? sundayOf(weekStartInput) : currentWeekStart;
  const dayDates = weekDates(weekStart);
  const weekEnd = dayDates[6];

  const ctxFor = indexDays(allMarketing, allLeads, allEod, allCloser, extras);

  // Today (and anything later) is still in progress — a partial day would
  // drag the week's rates and totals off. Hold it blank until it closes;
  // it fills in the next day. Past weeks are fully complete, nothing held.
  const todayE = easternDateString(now);

  const dayCtxs: DayCtx[] = dayDates.map((date) =>
    date >= todayE ? emptyDay(date) : ctxFor(date)
  );
  const scoredDays = dayCtxs.filter((c) => c.date < todayE);

  // Attribution over the completed days of this Sun–Sat week.
  const lastScored = scoredDays.length ? scoredDays[scoredDays.length - 1].date : null;
  const weekAttribution =
    extras.attribution && lastScored
      ? computeAttributionBuckets(
          [{ key: weekStart, label: "", start: weekStart, end: lastScored }],
          extras.attribution.portal,
          extras.attribution.pcn,
          extras.attribution.brands,
          extras.attribution.dataFloor,
        )[0].rate
      : null;

  const specByKey = new Map(
    buildSpecs(goals, weekAttribution)
      .flatMap((g) => g.metrics)
      .map((spec) => [spec.key, spec])
  );
  const groups: ScorecardGroup[] = SCORECARD_LAYOUT.map((g) => ({
    emoji: g.emoji,
    title: g.title,
    rows: g.keys
      .flatMap((key) => {
        const spec = specByKey.get(key);
        return spec ? [spec] : [];
      })
      // Offers without an affiliate portal feed have nothing to show here.
      .filter((spec) => spec.key !== "attributionRate" || !!extras.attribution)
      .map((spec) => {
        const days: ScorecardCell[] = dayCtxs.map((ctx) => {
          const value = ctx.date >= todayE ? null : spec.day(ctx);
          return {
            date: ctx.date,
            value,
            status: cellStatus(value, spec.goal, spec.goalDirection),
          };
        });
        const weekValue = spec.week(scoredDays);
        return {
          key: spec.key,
          label: spec.label,
          format: spec.format,
          goal: spec.goal,
          goalDirection: spec.goalDirection,
          cash: CASH_KEYS.has(spec.key),
          days,
          week: {
            value: weekValue,
            status: cellStatus(weekValue, spec.goal, spec.goalDirection),
          },
        };
      }),
  }));

  return {
    weekStart,
    weekEnd,
    weekLabel: formatWeekLabel(weekStart, weekEnd),
    dayDates,
    isCurrentWeek: weekStart >= currentWeekStart,
    groups,
  };
}

// --- Pacing ---------------------------------------------------------------

export type PacingRow = {
  key: string;
  label: string;
  format: StatFormat;
  cash: boolean;
  /** "total" metrics are projected forward; "rate" metrics pace at their to-date value. */
  kind: "total" | "rate";
  toDate: number | null;
  dailyAvg: number | null;
  projected: number | null;
  goal: number | null;
  goalDirection: GoalDirection | null;
  status: CellStatus;
};

export type PacingPeriod = {
  key: "month" | "week";
  label: string;
  start: string;
  end: string;
  /** Last completed day counted; null when no day of the period has closed yet. */
  through: string | null;
  daysElapsed: number;
  daysTotal: number;
  rows: PacingRow[];
};

export type PacingPayload = { periods: PacingPeriod[] };

const PACING_TOTALS = [
  "totalCashCollected",
  "cashCollectedLowTicket",
  "cashLtPaid",
  "cashLtOrganic",
  "cashCollectedHighTicket",
  "cashHtPaid",
  "cashHtOrganic",
  "adSpendMeta",
  "optInsPaid",
  "optInsOrganic",
  "salesLowTicket",
  "htCallsBooked",
  "htDealsClosed",
];
const PACING_RATES = ["roasTotal", "costPerLeadMeta", "cpaLowTicket"];

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = isoAddDays(d, 1)) out.push(d);
  return out;
}

function lastDayOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Month and week (Sun–Sat) pacing: completed days so far, projected to the
 * full period at the same daily rate. Today never counts (no partial days),
 * and if yesterday's Marketing Daily Metrics form isn't in yet, yesterday
 * waits too, so a missing form doesn't read as a $0 day and sink the pace.
 */
export function buildPacing(
  allMarketing: MarketingDailyMetricRow[],
  allLeads: LeadRow[],
  allEod: BronsonAffiliateEodRow[],
  allCloser: BronsonEodCloserRow[],
  goals: Awaited<ReturnType<typeof getGoals>>,
  now: Date = new Date()
): PacingPayload {
  const ctxFor = indexDays(allMarketing, allLeads, allEod, allCloser, {});
  const specByKey = new Map(
    buildSpecs(goals, null)
      .flatMap((g) => g.metrics)
      .map((spec) => [spec.key, spec])
  );

  const today = todayIso(now);
  const yesterday = isoAddDays(today, -1);
  const formDates = new Set(allMarketing.map((r) => r.date));
  const lastClosed = formDates.has(yesterday) ? yesterday : isoAddDays(yesterday, -1);

  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = sundayOf(today);
  const monthName = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  const periodDefs = [
    {
      key: "month" as const,
      label: monthName(monthStart),
      start: monthStart,
      end: lastDayOfMonth(monthStart),
    },
    {
      key: "week" as const,
      label: formatWeekLabel(weekStart, isoAddDays(weekStart, 6)),
      start: weekStart,
      end: isoAddDays(weekStart, 6),
    },
  ];

  return {
    periods: periodDefs.map((p) => {
      const through = lastClosed >= p.start ? lastClosed : null;
      const elapsed = through ? datesBetween(p.start, through).map(ctxFor) : [];
      const daysTotal = datesBetween(p.start, p.end).length;

      const rows: PacingRow[] = [...PACING_TOTALS, ...PACING_RATES].flatMap((key) => {
        const spec = specByKey.get(key);
        if (!spec) return [];
        const kind = PACING_RATES.includes(key) ? "rate" : "total";
        const toDate = elapsed.length ? spec.week(elapsed) : null;
        const dailyAvg =
          kind === "total" && toDate !== null ? toDate / elapsed.length : null;
        const projected =
          kind === "total" ? (dailyAvg !== null ? dailyAvg * daysTotal : null) : toDate;
        return [
          {
            key,
            label: spec.label,
            format: spec.format,
            cash: CASH_KEYS.has(key),
            kind,
            toDate,
            dailyAvg,
            projected,
            goal: kind === "rate" ? spec.goal : null,
            goalDirection: kind === "rate" ? spec.goalDirection : null,
            status: kind === "rate" ? cellStatus(projected, spec.goal, spec.goalDirection) : null,
          },
        ];
      });

      return {
        key: p.key,
        label: p.label,
        start: p.start,
        end: p.end,
        through,
        daysElapsed: elapsed.length,
        daysTotal,
        rows,
      };
    }),
  };
}
