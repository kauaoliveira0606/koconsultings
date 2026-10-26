import type { StatFormat } from "./format";
import type { BookingRow, MasterclassRegistrantRow } from "@/lib/airtable/tables";
import {
  BOOKINGS_TRACKING_START,
  connectedBookingIds,
  countedBookings,
  isConnectable,
  sessionShows,
  stayedUntilPitch,
  type BookingSource,
  type SourceBookingStats,
} from "@/lib/booking-source";
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
  /** The "bad" line, when the goal has one (see cellStatus). */
  redAt?: number | null;
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

/**
 * Green at or past the goal. `redAt` is the "bad" line: past it is red, and
 * between the two is yellow. Without one, red starts 20% off the goal.
 */
export function cellStatus(
  actual: number | null,
  goal: number | null,
  direction: GoalDirection | null,
  redAt: number | null = null,
): CellStatus {
  if (actual === null || goal === null || direction === null || !Number.isFinite(actual)) {
    return null;
  }
  if (direction === "higher") {
    if (actual >= goal) return "green";
    if (actual >= (redAt ?? goal * 0.8)) return "yellow";
    return "red";
  }
  if (actual <= goal) return "green";
  if (actual <= (redAt ?? goal * 1.2)) return "yellow";
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
  // Self-booked high ticket leads: given to the setter to reach out to / reached live.
  sbReach: number | null;
  sbConnected: number | null;
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
  /** Aval: affiliate buyers that day, and how many booked a high ticket call; null when not tracked. */
  ltBuyers: number | null;
  ltBuyersBooked: number | null;
  /** Connected (1+ min) calls by lead tag; null before tag tracking started. */
  connectedPaid: number | null;
  connectedOrganic: number | null;
  /** Calendly bookings made that day by source (Bronson); null before tracking. */
  bk: Record<BookingSource, SourceBookingStats> | null;
  /** Registrants who stayed until the pitch that session day, by source. */
  stayed: Record<BookingSource, number> | null;
  /** Registered / attended live for that session day, by source. */
  shows: Record<BookingSource, { registered: number; attended: number }> | null;
};

/**
 * Optional per-offer inputs for rows that live outside the shared form/EOD
 * tables. Any piece left out just renders that row blank.
 */
export type ScorecardExtras = {
  /** Rows to show and their order; defaults to the full layout. */
  layout?: ScorecardLayout;
  pcn?: { date: string | null; plan: string | null }[];
  connected?: ConnectedCallRow[];
  connectionTrackingStart?: string;
  /** Bronson: Calendly bookings with the lead's masterclass paid / organic tag. */
  bookings?: BookingRow[];
  registrants?: MasterclassRegistrantRow[];
  /** Aval: affiliate buyers by purchase day, each marked if they booked a high ticket call. */
  affiliateBuyers?: { date: string; booked: boolean }[];
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
const dVipCashPaid = (c: DayCtx) => (c.m ? num(c.m.vipCashPaid) : null);
const dVipCashOrg = (c: DayCtx) => (c.m ? num(c.m.vipCashOrganic) : null);
const dAiCashPaid = (c: DayCtx) => (c.m ? num(c.m.bronsonAiCashPaid) : null);
const dAiCashOrg = (c: DayCtx) => (c.m ? num(c.m.bronsonAiCashOrganic) : null);
// Total cash: affiliate + high ticket + webinar VIP + Bronson AI.
const dTotalCash = (c: DayCtx) => {
  const parts = [dCashLT(c), dCashHT(c), dVipCashPaid(c), dVipCashOrg(c), dAiCashPaid(c), dAiCashOrg(c)];
  if (parts.every((v) => v === null)) return null;
  return parts.reduce((t: number, v) => t + (v ?? 0), 0);
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
/** All paid cash that day, affiliate + high ticket + webinar VIP + Bronson AI: what ROAS is measured on. */
const dCashPaid = (c: DayCtx) => {
  const parts = [dCashLTPaid(c), dCashHTPaid(c), dVipCashPaid(c), dAiCashPaid(c)];
  return parts.every((v) => v === null) ? null : parts.reduce((t: number, v) => t + (v ?? 0), 0);
};

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
// --- webinar funnel (Marketing Daily Metrics form only) ---
const addBoth = (a: number | null, b: number | null) =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);
const dVipPurchases = (c: DayCtx) =>
  c.m ? addBoth(num(c.m.vipPurchasesPaid), num(c.m.vipPurchasesOrganic)) : null;
const dVipCash = (c: DayCtx) => addBoth(dVipCashPaid(c), dVipCashOrg(c));
const dWebinarOptInsPaid = (c: DayCtx) => (c.m ? num(c.m.webinarOptInsPaid) : null);
const dWebinarOptInsOrg = (c: DayCtx) => (c.m ? num(c.m.webinarOptInsOrganic) : null);
const dVipPurchasesPaid = (c: DayCtx) => (c.m ? num(c.m.vipPurchasesPaid) : null);
const dVipPurchasesOrg = (c: DayCtx) => (c.m ? num(c.m.vipPurchasesOrganic) : null);
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
  redAt?: number | null;
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

  const groups: { emoji: string; title: string; metrics: MetricSpec[] }[] = [
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
          redAt: goals.costPerLeadMeta?.redAbove ?? null,
          // Form's typed CPL first; calculated only on days it's blank, as
          // ad spend ÷ paid webinar opt-ins (not the old Leads-table
          // affiliate opt-ins). The week averages the days (TYPED_RATE_KEYS).
          day: (c) =>
            (c.m ? num(c.m.costPerLeadMeta) : null) ??
            safeDivide(dAdSpend(c), dWebinarOptInsPaid(c) || null),
          week: (days) => average(days.map((c) => (c.m ? num(c.m.costPerLeadMeta) : null) ?? safeDivide(dAdSpend(c), dWebinarOptInsPaid(c) || null))),
        },
        {
          key: "cashCollectedLowTicket",
          label: "Cash Collected – Affiliate",
          format: "currency",
          goal: goals.cashCollectedLowTicket,
          goalDirection: goals.cashCollectedLowTicket === null ? null : "higher",
          day: dCashLT,
          week: wSum(dCashLT),
        },
        {
          key: "cashLtPaid",
          label: "↳ Cash Affiliate (Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dCashLTPaid,
          week: wSum(dCashLTPaid),
        },
        {
          key: "cashLtOrganic",
          label: "↳ Cash Affiliate (Organic)",
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
          label: "ROAS (Paid Cash Affiliate + HT + VIP ÷ Ad Spend)",
          format: "ratio",
          goal: goals.roasTotal?.min ?? null,
          goalDirection: "higher",
          day: (c) => roas(dCashPaid(c), dAdSpend(c)),
          week: (days) => roas(sum(days.map(dCashPaid)), sum(days.map(dAdSpend))),
        },
        {
          key: "cpaLowTicket",
          label: "CPA – Affiliate (Paid)",
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
          // Ad spend only buys paid calls (user, 2026-10-19): over the paid Calendly
          // bookings made that day. Blank where bookings aren't tracked, never all calls.
          key: "costPerCallHT",
          label: "Cost Per Call (HT, Paid)",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: (c) => (c.bk ? safeDivide(dSpendOrNull(c), c.bk.Paid.booked || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.bk);
            return t.length ? safeDivide(wSpendOrNull(t), sum(t.map((c) => c.bk!.Paid.booked)) || null) : null;
          },
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
          // Same count as Opt-Ins (Organic), named for Aval's Lead Flow.
          key: "base44OptInsOrganic",
          label: "Base44 Opt-Ins (Organic)",
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
          label: "Sales – Affiliate",
          format: "number",
          goal: goals.salesLowTicket,
          goalDirection: goals.salesLowTicket === null ? null : "higher",
          day: dSalesLT,
          week: wSum(dSalesLT),
        },
        {
          key: "salesLtPaid",
          label: "↳ Sales Affiliate (Paid)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dSalesLTPaid,
          week: wSum(dSalesLTPaid),
        },
        {
          key: "salesLtOrganic",
          label: "↳ Sales Affiliate (Organic)",
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
          // Affiliate EOD "software closed" ÷ pickups (client definition,
          // 2026-10-23).
          day: (c) => safeDivide(dEodClosed(c), dPickups(c) || null),
          week: (days) => safeDivide(sum(days.map(dEodClosed)), sum(days.map(dPickups)) || null),
        },
        {
          key: "aovLowTicket",
          label: "AOV – Affiliate",
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
          label: "HT Booking Rate (from Affiliate)",
          format: "percent",
          goal: null,
          goalDirection: null,
          // Aval: affiliate buyers who booked an HT call ÷ affiliate buyers
          // (client definition, 2026-10-25). Elsewhere: EOD new HT booked ÷ sales.
          day: (c) =>
            c.ltBuyers !== null
              ? safeDivide(c.ltBuyersBooked, c.ltBuyers || null)
              : safeDivide(dNewHtBooked(c), dSalesLT(c) || null),
          week: (days) =>
            days.some((c) => c.ltBuyers !== null)
              ? safeDivide(sum(days.map((c) => c.ltBuyersBooked)), sum(days.map((c) => c.ltBuyers)) || null)
              : safeDivide(sum(days.map(dNewHtBooked)), sum(days.map(dSalesLT)) || null),
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
          redAt: goals.landingPageConnectRate?.redBelow ?? null,
          day: fromM((r) => r.landingPageConnectRate),
          week: wAvg(fromM((r) => r.landingPageConnectRate)),
        },
        {
          key: "optInRate",
          label: "Opt-In Rate (Paid)",
          format: "percent",
          goal: goals.optInRate?.min ?? null,
          goalDirection: "higher",
          redAt: goals.optInRate?.redBelow ?? null,
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
          // Falls back to the plain average when the form has rates but no views.
          week: (days) =>
            vslTotals(days.flatMap((c) => (c.m ? [c.m] : []))).vslPlayRate ??
            average(days.map(fromM((r) => r.vslPlayRate))),
        },
        {
          key: "vslEngagementRate",
          label: "VSL Engagement Rate (Paid)",
          format: "percent",
          goal: goals.vslEngagementRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslEngagementRate),
          // Weighted by plays, same as the Overview card.
          week: (days) =>
            vslTotals(days.flatMap((c) => (c.m ? [c.m] : []))).vslEngagementRate ??
            average(days.map(fromM((r) => r.vslEngagementRate))),
        },
        {
          key: "htVslViews",
          label: "High Ticket VSL Views",
          format: "number",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.htVslViews),
          week: wSum(fromM((r) => r.htVslViews)),
        },
        {
          key: "htVslPlayRate",
          label: "High Ticket VSL Play Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.htVslPlayRate),
          // Weighted by views: plays ÷ views across the week.
          week: (days) =>
            safeDivide(sum(days.map(fromM((r) => r.htVslPlays))), sum(days.map(fromM((r) => r.htVslViews))) || null),
        },
        {
          key: "htVslEngagementRate",
          label: "High Ticket VSL Engagement Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.htVslEngagementRate),
          // Weighted by plays.
          week: (days) => {
            const played = days.flatMap((c) =>
              c.m && num(c.m.htVslEngagementRate) !== null && (num(c.m.htVslPlays) ?? 0) > 0 ? [c.m] : []
            );
            return safeDivide(
              sum(played.map((r) => (r.htVslEngagementRate as number) * (r.htVslPlays as number))),
              sum(played.map((r) => r.htVslPlays)) || null,
            );
          },
        },
      ],
    },
    {
      emoji: "🎥",
      title: "Webinar",
      metrics: [
        {
          key: "webinarOptInsPaid",
          label: "Webinar Opt-Ins (Paid)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.webinarOptInsPaid),
          week: wSum(fromM((r) => r.webinarOptInsPaid)),
        },
        {
          key: "webinarOptInsOrganic",
          label: "Webinar Opt-Ins (Organic)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.webinarOptInsOrganic),
          week: wSum(fromM((r) => r.webinarOptInsOrganic)),
        },
        {
          key: "webinarOptInRate",
          label: "Webinar Opt-In Rate",
          format: "percent",
          goal: goals.webinarOptInRate?.min ?? null,
          goalDirection: goals.webinarOptInRate ? "higher" : null,
          redAt: goals.webinarOptInRate?.redBelow ?? null,
          day: fromM((r) => r.webinarOptInRate),
          week: wAvg(fromM((r) => r.webinarOptInRate)),
        },
        {
          key: "vipPurchases",
          label: "VIP Purchases",
          format: "number",
          goal: null,
          goalDirection: null,
          day: dVipPurchases,
          week: wSum(dVipPurchases),
        },
        {
          key: "vipCash",
          label: "VIP Cash",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: dVipCash,
          week: wSum(dVipCash),
        },
        {
          key: "vipTakeRatePaid",
          label: "Take Rate (Paid)",
          format: "percent",
          goal: goals.vipTakeRate?.min ?? null,
          goalDirection: goals.vipTakeRate ? "higher" : null,
          redAt: goals.vipTakeRate?.redBelow ?? null,
          day: (c) => safeDivide(dVipPurchasesPaid(c), dWebinarOptInsPaid(c) || null),
          week: (days) => safeDivide(sum(days.map(dVipPurchasesPaid)), sum(days.map(dWebinarOptInsPaid)) || null),
        },
        {
          key: "vipTakeRateOrganic",
          label: "Take Rate (Organic)",
          format: "percent",
          goal: goals.vipTakeRate?.min ?? null,
          goalDirection: goals.vipTakeRate ? "higher" : null,
          redAt: goals.vipTakeRate?.redBelow ?? null,
          day: (c) => safeDivide(dVipPurchasesOrg(c), dWebinarOptInsOrg(c) || null),
          week: (days) => safeDivide(sum(days.map(dVipPurchasesOrg)), sum(days.map(dWebinarOptInsOrg)) || null),
        },
        {
          // Bronson (user, 2026-10-19): self-booked leads connected ÷ self-booked
          // calls to reach out to, both from the setters' Affiliate EOD.
          key: "callConnectionRate",
          label: "Call Connection Rate",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => safeDivide(c.eod?.sbConnected ?? null, c.eod?.sbReach || null),
          week: (days) =>
            safeDivide(
              sumLeads(days, (c) => c.eod?.sbConnected ?? null),
              sumLeads(days, (c) => c.eod?.sbReach ?? null),
            ),
        },
        {
          // Attended live ÷ registered for that session, by masterclass tag (WebinarJam).
          key: "webinarShowRatePaid",
          label: "Show Rate (Paid)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => (c.shows ? safeDivide(c.shows.Paid.attended, c.shows.Paid.registered || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.shows);
            return t.length
              ? safeDivide(sum(t.map((c) => c.shows!.Paid.attended)), sum(t.map((c) => c.shows!.Paid.registered)) || null)
              : null;
          },
        },
        {
          // Attended live ÷ registered for that session, by masterclass tag (WebinarJam).
          key: "webinarShowRateOrganic",
          label: "Show Rate (Organic)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => (c.shows ? safeDivide(c.shows.Organic.attended, c.shows.Organic.registered || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.shows);
            return t.length
              ? safeDivide(sum(t.map((c) => c.shows!.Organic.attended)), sum(t.map((c) => c.shows!.Organic.registered)) || null)
              : null;
          },
        },
        // Bronson (user, 2026-10-19): Calendly bookings by the lead's masterclass
        // paid / organic tag; booking rate over registrants who stayed until the pitch, and
        // connected = a 1+ min GHL call between booking and the call (automatic).
        {
          key: "callsPaidBooked",
          label: "Calls Booked (Paid)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: (c) => (c.bk ? c.bk.Paid.booked : null),
          week: (days) => (days.some((c) => c.bk) ? sum(days.map((c) => (c.bk ? c.bk.Paid.booked : null))) : null),
        },
        {
          key: "bookingRatePaid",
          label: "Booking Rate (Paid)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => (c.bk && c.stayed ? safeDivide(c.bk.Paid.booked, c.stayed.Paid || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.bk && c.stayed);
            return t.length
              ? safeDivide(sum(t.map((c) => c.bk!.Paid.booked)), sum(t.map((c) => c.stayed!.Paid)) || null)
              : null;
          },
        },
        {
          key: "bookedConnRatePaid",
          label: "Connection Rate (Paid)",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => (c.bk ? safeDivide(c.bk.Paid.connected, c.bk.Paid.connectable || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.bk);
            return t.length ? safeDivide(sum(t.map((c) => c.bk!.Paid.connected)), sum(t.map((c) => c.bk!.Paid.connectable)) || null) : null;
          },
        },
        {
          key: "callsOrganicBooked",
          label: "Calls Booked (Organic)",
          format: "number",
          goal: null,
          goalDirection: null,
          day: (c) => (c.bk ? c.bk.Organic.booked : null),
          week: (days) => (days.some((c) => c.bk) ? sum(days.map((c) => (c.bk ? c.bk.Organic.booked : null))) : null),
        },
        {
          key: "bookingRateOrganic",
          label: "Booking Rate (Organic)",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: (c) => (c.bk && c.stayed ? safeDivide(c.bk.Organic.booked, c.stayed.Organic || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.bk && c.stayed);
            return t.length
              ? safeDivide(sum(t.map((c) => c.bk!.Organic.booked)), sum(t.map((c) => c.stayed!.Organic)) || null)
              : null;
          },
        },
        {
          key: "bookedConnRateOrganic",
          label: "Connection Rate (Organic)",
          format: "percent",
          goal: goals.connectionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => (c.bk ? safeDivide(c.bk.Organic.connected, c.bk.Organic.connectable || null) : null),
          week: (days) => {
            const t = days.filter((c) => c.bk);
            return t.length ? safeDivide(sum(t.map((c) => c.bk!.Organic.connected)), sum(t.map((c) => c.bk!.Organic.connectable)) || null) : null;
          },
        },
        {
          key: "hookRate",
          label: "Hook Rate",
          format: "percent",
          goal: goals.hookRate?.min ?? null,
          goalDirection: goals.hookRate ? "higher" : null,
          redAt: goals.hookRate?.redBelow ?? null,
          day: fromM((r) => r.hookRate),
          week: wAvg(fromM((r) => r.hookRate)),
        },
        {
          key: "holdRate",
          label: "Hold Rate",
          format: "percent",
          goal: goals.holdRate?.min ?? null,
          goalDirection: goals.holdRate ? "higher" : null,
          redAt: goals.holdRate?.redBelow ?? null,
          day: fromM((r) => r.holdRate),
          week: wAvg(fromM((r) => r.holdRate)),
        },
        {
          key: "linkClickThroughRate",
          label: "Link Click-Through Rate",
          format: "percent",
          goal: goals.linkClickThroughRate?.min ?? null,
          goalDirection: goals.linkClickThroughRate ? "higher" : null,
          redAt: goals.linkClickThroughRate?.redBelow ?? null,
          day: fromM((r) => r.linkClickThroughRate),
          week: wAvg(fromM((r) => r.linkClickThroughRate)),
        },
        {
          key: "costPerLinkClick",
          label: "Cost Per Link Click",
          format: "currency",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.costPerLinkClick),
          week: wAvg(fromM((r) => r.costPerLinkClick)),
        },
        {
          key: "cpm",
          label: "CPM",
          format: "currency",
          goal: goals.cpm?.max ?? null,
          goalDirection: goals.cpm ? "lower" : null,
          redAt: goals.cpm?.redAbove ?? null,
          day: fromM((r) => r.cpm),
          week: wAvg(fromM((r) => r.cpm)),
        },
        {
          key: "adFrequency",
          label: "Frequency",
          format: "number",
          goal: goals.adFrequency?.max ?? null,
          goalDirection: goals.adFrequency ? "lower" : null,
          redAt: goals.adFrequency?.redAbove ?? null,
          day: fromM((r) => r.adFrequency),
          week: wAvg(fromM((r) => r.adFrequency)),
        },
        {
          key: "webinarShowRate",
          label: "Webinar Show Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.webinarShowRate),
          week: wAvg(fromM((r) => r.webinarShowRate)),
        },
        {
          key: "liveAttendees",
          label: "Live Attendees",
          format: "number",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.liveAttendees),
          week: wSum(fromM((r) => r.liveAttendees)),
        },
        {
          key: "liveAttendeesAtPitch",
          label: "Live Attendees At Pitch",
          format: "number",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.liveAttendeesAtPitch),
          week: wSum(fromM((r) => r.liveAttendeesAtPitch)),
        },
        {
          key: "retentionRateUntilPitch",
          label: "Retention Rate Until Pitch",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.retentionRateUntilPitch),
          week: wAvg(fromM((r) => r.retentionRateUntilPitch)),
        },
        {
          key: "webinarBookingRate",
          label: "Webinar Booking Rate",
          format: "percent",
          goal: null,
          goalDirection: null,
          day: fromM((r) => r.webinarBookingRate),
          week: wAvg(fromM((r) => r.webinarBookingRate)),
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

  // Rows whose day cell is the rate the team typed into the Marketing Daily
  // Metrics form (calculated only when a day has none typed). Their week
  // total is the plain average of the day cells shown, so it always matches
  // the days next to it instead of being recalculated from other tables.
  return groups.map((g) => ({
    ...g,
    metrics: g.metrics.map((spec) =>
      TYPED_RATE_KEYS.has(spec.key)
        ? { ...spec, week: (days: DayCtx[]) => average(days.map(spec.day)) }
        : spec
    ),
  }));
}

const TYPED_RATE_KEYS = new Set([
  "costPerLeadMeta",
  "funnelConvPaid",
  "funnelConvOrganic",
  "closeRateLowTicket",
  "optInRate",
  "connectionRate",
]);

/**
 * Display order, mirroring the Overview dashboard's tiers, with a Hierarchy
 * section on top for the numbers checked first. Metric definitions live in
 * buildSpecs; this only decides where each one shows up.
 */
export type ScorecardLayout = { emoji: string; title: string; keys: string[] }[];

const SCORECARD_LAYOUT: ScorecardLayout = [
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
    emoji: "🎥",
    title: "Webinar",
    keys: [
      "webinarOptInsPaid",
      "webinarOptInsOrganic",
      "webinarOptInRate",
      "vipPurchases",
      "vipCash",
      "vipTakeRatePaid",
      "vipTakeRateOrganic",
      "hookRate",
      "holdRate",
      "linkClickThroughRate",
      "costPerLinkClick",
      "cpm",
      "adFrequency",
    ],
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

/**
 * Bronson's scorecard (user, 2026-10-14): the affiliate funnel is winding
 * down and the business moved to webinars, so the affiliate-funnel rows
 * (Lead Flow, CPA, affiliate close rate / AOV / paid-organic sales split,
 * software pitch rate, HT booking rate from affiliate) and the Funnel &
 * Marketing Health and Attribution & Refunds sections are left off.
 * 2026-10-18: Bronson no longer runs affiliate at all, so the affiliate cash
 * rows, the setter funnel (Front-End Sales Conversion, all from the
 * Affiliate EOD and Leads table) and the affiliate unit economics go too.
 * Old affiliate cash still counts in Total Cash Collected. The post-webinar
 * card rows join the Webinar section.
 */
const BRONSON_DROPPED = new Set([
  "cashCollectedLowTicket",
  "cashLtPaid",
  "cashLtOrganic",
  "cpaLowTicket",
  "pitchRate",
  "salesLtPaid",
  "salesLtOrganic",
  "closeRateLowTicket",
  "aovLowTicket",
  "htBookingRateFromLt",
  "leadToCloseRate",
  "cashPerOptInPaid",
]);
const BRONSON_DROPPED_SECTIONS = new Set([
  "Lead Flow",
  "Front-End Sales Conversion",
  "Funnel & Marketing Health",
  "Attribution & Refunds",
]);
const WEBINAR_CARD_KEYS = [
  "webinarShowRate",
  "liveAttendees",
  "liveAttendeesAtPitch",
  "retentionRateUntilPitch",
  "webinarBookingRate",
  "callConnectionRate",
  "webinarShowRatePaid",
  "webinarShowRateOrganic",
  "callsPaidBooked",
  "bookingRatePaid",
  "bookedConnRatePaid",
  "callsOrganicBooked",
  "bookingRateOrganic",
  "bookedConnRateOrganic",
];
export const BRONSON_SCORECARD_LAYOUT: ScorecardLayout = SCORECARD_LAYOUT.filter(
  (g) => !BRONSON_DROPPED_SECTIONS.has(g.title),
).map((g) => {
  const keys = g.keys.filter((k) => !BRONSON_DROPPED.has(k));
  if (g.title !== "Webinar") return { ...g, keys };
  const at = keys.indexOf("vipPurchases");
  return { ...g, keys: [...keys.slice(0, at), ...WEBINAR_CARD_KEYS, ...keys.slice(at)] };
});

/** Bronson's pacing rows: no affiliate rows (same reason as above). */
export const BRONSON_PACING_ROWS = {
  totals: [
    "totalCashCollected",
    "cashCollectedHighTicket",
    "cashHtPaid",
    "cashHtOrganic",
    "adSpendMeta",
    "htCallsBooked",
    "htDealsClosed",
  ],
  rates: ["roasTotal", "costPerLeadMeta"],
};

/**
 * Aval's scorecard: all affiliate rows, paid and organic, are back (user,
 * 2026-10-22: paid opt-ins, paid connection rate, CPA – Affiliate, funnel conversion). The
 * live webinar form fields join the Webinar section and the VSL rows track
 * the high ticket VSL on /apply.
 * Sections are one per funnel (user, 2026-10-16): General, Affiliate,
 * Webinar, VSL (High Ticket).
 */
export const AVAL_SCORECARD_LAYOUT: ScorecardLayout = [
  {
    emoji: "💰",
    title: "General",
    keys: [
      "totalCashCollected",
      "adSpendMeta",
      "roasTotal",
      "costPerLeadMeta",
    ],
  },
  {
    emoji: "🤝",
    title: "Affiliate",
    keys: [
      "optInsPaid",
      "base44OptInsOrganic",
      "vslViews",
      "vslPlayRate",
      "vslEngagementRate",
      "optInRate",
      "dials",
      "pickups",
      "pickupRate",
      "connectionRate",
      "connectionRatePaid",
      "connectionRateOrganic",
      "softwarePitched",
      "pitchRate",
      "salesLowTicket",
      "salesLtPaid",
      "salesLtOrganic",
      "closeRateLowTicket",
      "aovLowTicket",
      "leadToCloseRate",
      "funnelConvPaid",
      "funnelConvOrganic",
      "cashCollectedLowTicket",
      "cashLtPaid",
      "cashLtOrganic",
      "cashPerOptInPaid",
      "cpaLowTicket",
      "yearlyShare",
      "attributionRate",
      "htBookingRateFromLt",
    ],
  },
  {
    emoji: "🎥",
    title: "Webinar",
    keys: [
      "webinarOptInsPaid",
      "webinarOptInsOrganic",
      "webinarOptInRate",
      "webinarShowRate",
      "liveAttendees",
      "liveAttendeesAtPitch",
      "retentionRateUntilPitch",
      "webinarBookingRate",
      "vipPurchases",
      "vipCash",
      "vipTakeRatePaid",
      "vipTakeRateOrganic",
      "hookRate",
      "holdRate",
      "linkClickThroughRate",
      "costPerLinkClick",
      "cpm",
      "adFrequency",
    ],
  },
  {
    emoji: "🎯",
    title: "VSL (High Ticket)",
    keys: [
      "landingPageConnectRate",
      "htVslViews",
      "htVslPlayRate",
      "htVslEngagementRate",
      "htCallsBooked",
      "htCallsShowed",
      "htShowRate",
      "htDealsClosed",
      "htCloseRate",
      "aovHighTicket",
      "revenueHighTicket",
      "cashCollectedHighTicket",
      "cashHtPaid",
      "cashHtOrganic",
      "cacHighTicketPaid",
      "costPerCallHT",
      "collectedPerBookedCallHT",
    ],
  },
];

/** Aval's pacing rows: paid and organic affiliate opt-ins, CPA – Affiliate. */
export const AVAL_PACING_ROWS = {
  totals: [
    "totalCashCollected",
    "cashCollectedLowTicket",
    "cashLtPaid",
    "cashLtOrganic",
    "cashCollectedHighTicket",
    "cashHtPaid",
    "cashHtOrganic",
    "adSpendMeta",
    "optInsPaid",
    "base44OptInsOrganic",
    "salesLowTicket",
    "htCallsBooked",
    "htDealsClosed",
  ],
  rates: ["roasTotal", "costPerLeadMeta", "cpaLowTicket"],
};

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
  ltBuyers: null,
  ltBuyersBooked: null,
  connectedPaid: null,
  connectedOrganic: null,
  bk: null,
  stayed: null,
  shows: null,
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
      sbReach: null,
      sbConnected: null,
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
      sbReach: add(cur.sbReach, num(r.selfBookedToReachOut ?? null)),
      sbConnected: add(cur.sbConnected, num(r.selfBookedConnected ?? null)),
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

  const ltBuyersByDate = new Map<string, number>();
  const ltBookedByDate = new Map<string, number>();
  for (const b of extras.affiliateBuyers ?? []) {
    ltBuyersByDate.set(b.date, (ltBuyersByDate.get(b.date) ?? 0) + 1);
    if (b.booked) ltBookedByDate.set(b.date, (ltBookedByDate.get(b.date) ?? 0) + 1);
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

  // Bookings by the day they were made, with "connected" judged per booking.
  const bkByDate = new Map<string, Record<BookingSource, SourceBookingStats>>();
  if (extras.bookings) {
    const counted = countedBookings(extras.bookings);
    const conn = connectedBookingIds(counted, extras.connected ?? []);
    for (const b of counted) {
      if (b.source !== "Paid" && b.source !== "Organic") continue;
      const day = bkByDate.get(b.bookedDate!) ?? {
        Paid: { booked: 0, canceled: 0, connected: 0, connectable: 0 },
        Organic: { booked: 0, canceled: 0, connected: 0, connectable: 0 },
      };
      const st = day[b.source];
      st.booked += 1;
      if (b.canceled) st.canceled += 1;
      if (isConnectable(b)) {
        st.connectable += 1;
        if (conn.has(b.id)) st.connected += 1;
      }
      bkByDate.set(b.bookedDate!, day);
    }
  }
  const zeroBk = (): Record<BookingSource, SourceBookingStats> => ({
    Paid: { booked: 0, canceled: 0, connected: 0, connectable: 0 },
    Organic: { booked: 0, canceled: 0, connected: 0, connectable: 0 },
  });

  return (date) => ({
    date,
    m: byDate.get(date),
    eod: eodByDate.get(date),
    closer: closerByDate.get(date),
    paidLeads: paidByDate.get(date) ?? 0,
    organicLeads: organicByDate.get(date) ?? 0,
    pcnTotal: pcnTotalByDate.get(date) ?? 0,
    pcnYearly: pcnYearlyByDate.get(date) ?? 0,
    ltBuyers: extras.affiliateBuyers ? (ltBuyersByDate.get(date) ?? 0) : null,
    ltBuyersBooked: extras.affiliateBuyers ? (ltBookedByDate.get(date) ?? 0) : null,
    connectedPaid: connTracked(date) ? (connPaidByDate.get(date) ?? 0) : null,
    connectedOrganic: connTracked(date) ? (connOrgByDate.get(date) ?? 0) : null,
    bk: extras.bookings && date >= BOOKINGS_TRACKING_START ? (bkByDate.get(date) ?? zeroBk()) : null,
    stayed:
      extras.registrants && date >= BOOKINGS_TRACKING_START
        ? stayedUntilPitch(extras.registrants, (d) => d === date)
        : null,
    shows:
      extras.registrants && date >= BOOKINGS_TRACKING_START
        ? sessionShows(extras.registrants, (d) => d === date)
        : null,
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
  const groups: ScorecardGroup[] = (extras.layout ?? SCORECARD_LAYOUT).map((g) => ({
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
            status: cellStatus(value, spec.goal, spec.goalDirection, spec.redAt ?? null),
          };
        });
        const weekValue = spec.week(scoredDays);
        return {
          key: spec.key,
          label: spec.label,
          format: spec.format,
          goal: spec.goal,
          goalDirection: spec.goalDirection,
          redAt: spec.redAt ?? null,
          cash: CASH_KEYS.has(spec.key),
          days,
          week: {
            value: weekValue,
            status: cellStatus(weekValue, spec.goal, spec.goalDirection, spec.redAt ?? null),
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
  redAt?: number | null;
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
  now: Date = new Date(),
  pacingRows: { totals: string[]; rates: string[] } = { totals: PACING_TOTALS, rates: PACING_RATES },
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

      const rows: PacingRow[] = [...pacingRows.totals, ...pacingRows.rates].flatMap((key) => {
        const spec = specByKey.get(key);
        if (!spec) return [];
        const kind = pacingRows.rates.includes(key) ? "rate" : "total";
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
            redAt: kind === "rate" ? (spec.redAt ?? null) : null,
            status: kind === "rate" ? cellStatus(projected, spec.goal, spec.goalDirection, spec.redAt ?? null) : null,
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
