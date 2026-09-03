import type { StatFormat } from "./format";
import type {
  BronsonAffiliateEodRow,
  BronsonEodCloserRow,
  LeadRow,
  MarketingDailyMetricRow,
} from "./airtable/tables";
import { isOrganicSource, isPaidSource } from "./airtable/lead-source-lookup";
import { easternDateString, toEasternDateOnly } from "./date-range";
import { average, roas, safeDivide, sum } from "./metrics";
import { getGoals } from "./goals";

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
  direction: GoalDirection | null
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
};

/** EOD Closer, summed across all closer rows for one day (legacy fallback). */
type CloserDay = {
  callsBooked: number | null;
  callsShowed: number | null;
  dealsClosed: number | null;
  cashHighTicket: number | null;
};

/**
 * Everything a single day's cell needs. Derived values (dials, sales, cash,
 * close rate, …) prefer the Affiliate EOD roll-up so the team doesn't have
 * to re-key them into the Marketing Daily Metrics form; the form value is
 * the fallback for days with no EOD submission. Video / landing-page / ad
 * metrics have no other source and stay form-only.
 */
type DayCtx = {
  date: string;
  m?: MarketingDailyMetricRow;
  eod?: EodDay;
  closer?: CloserDay;
  paidLeads: number;
  organicLeads: number;
};

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v;

// --- per-day component accessors (EOD-preferred, form fallback) ---
const dAdSpend = (c: DayCtx) => (c.m ? num(c.m.adSpendMeta) : null);
const dSalesLT = (c: DayCtx) =>
  c.eod ? num(c.eod.closed) : c.m ? num(c.m.salesLowTicket) : null;
const dPitched = (c: DayCtx) => (c.eod ? num(c.eod.pitched) : null);
const dPickups = (c: DayCtx) => (c.eod ? num(c.eod.pickups) : null);
const dDials = (c: DayCtx) => (c.eod ? num(c.eod.dials) : c.m ? num(c.m.dials) : null);
const dCashLT = (c: DayCtx) =>
  c.eod ? num(c.eod.cashLowTicket) : c.m ? num(c.m.cashCollectedLowTicket) : null;
const dCashHT = (c: DayCtx) =>
  c.eod
    ? num(c.eod.htCash)
    : c.closer
      ? num(c.closer.cashHighTicket)
      : c.m
        ? num(c.m.cashCollectedHighTicket)
        : null;
const dTotalCash = (c: DayCtx) => {
  const lt = dCashLT(c);
  const ht = dCashHT(c);
  if (lt === null && ht === null) return null;
  return (lt ?? 0) + (ht ?? 0);
};
const dLeads = (c: DayCtx) => c.paidLeads + c.organicLeads;

// --- high-ticket: Affiliate EOD (setters log it), EOD Closer as fallback ---
const dHtBooked = (c: DayCtx) =>
  c.eod ? num(c.eod.htBooked) : c.closer ? num(c.closer.callsBooked) : null;
const dHtShowed = (c: DayCtx) =>
  c.eod ? num(c.eod.htShowed) : c.closer ? num(c.closer.callsShowed) : null;
const dHtClosed = (c: DayCtx) =>
  c.eod ? num(c.eod.htClosed) : c.closer ? num(c.closer.dealsClosed) : null;

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

function buildSpecs(goals: Awaited<ReturnType<typeof getGoals>>): {
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
          day: fromM((r) => r.costPerLeadMeta),
          week: (days) =>
            safeDivide(
              sum(days.map(dAdSpend)),
              days.reduce((n, c) => n + c.paidLeads, 0) || null
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
          key: "funnelConversionRate",
          label: "Funnel Conversion Rate",
          format: "percent",
          goal: goals.funnelConversionRate?.min ?? null,
          goalDirection: "higher",
          day: (c) => safeDivide(dSalesLT(c), dLeads(c) || null) ?? (c.m ? num(c.m.funnelConversionRate) : null),
          week: (days) =>
            safeDivide(
              sum(days.map(dSalesLT)),
              days.reduce((n, c) => n + dLeads(c), 0) || null
            ),
        },
        {
          key: "roasTotal",
          label: "ROAS – Total",
          format: "ratio",
          goal: goals.roasTotal?.min ?? null,
          goalDirection: "higher",
          day: (c) => roas(dTotalCash(c), dAdSpend(c)),
          week: (days) => roas(sum(days.map(dTotalCash)), sum(days.map(dAdSpend))),
        },
        {
          key: "cpaLowTicket",
          label: "CPA – Low Ticket",
          format: "currency",
          goal: goals.cpaLowTicket?.max ?? null,
          goalDirection: "lower",
          day: (c) => safeDivide(dAdSpend(c), dSalesLT(c)),
          week: (days) => safeDivide(sum(days.map(dAdSpend)), sum(days.map(dSalesLT))),
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
          day: (c) => (c.paidLeads > 0 || c.m ? c.paidLeads : null),
          week: (days) => days.reduce((n, c) => n + c.paidLeads, 0),
        },
        {
          key: "optInsOrganic",
          label: "Opt-Ins (Organic)",
          format: "number",
          goal: goals.optInsOrganic,
          goalDirection: goals.optInsOrganic === null ? null : "higher",
          day: (c) => (c.organicLeads > 0 || c.m ? c.organicLeads : null),
          week: (days) => days.reduce((n, c) => n + c.organicLeads, 0),
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
          key: "salesLowTicket",
          label: "Sales – Low Ticket",
          format: "number",
          goal: goals.salesLowTicket,
          goalDirection: goals.salesLowTicket === null ? null : "higher",
          day: dSalesLT,
          week: wSum(dSalesLT),
        },
        {
          key: "closeRateLowTicket",
          label: "Close Rate – Low Ticket",
          format: "percent",
          goal: goals.closeRateLowTicket?.min ?? null,
          goalDirection: "higher",
          day: (c) =>
            safeDivide(dSalesLT(c), dPitched(c)) ?? (c.m ? num(c.m.closeRateLowTicket) : null),
          week: (days) => safeDivide(sum(days.map(dSalesLT)), sum(days.map(dPitched))),
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
          label: "Opt-In Rate (Opt-Ins vs Views)",
          format: "percent",
          goal: goals.optInRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.optInRate),
          week: wAvg(fromM((r) => r.optInRate)),
        },
        {
          key: "vslPlayRate",
          label: "VSL Play Rate",
          format: "percent",
          goal: goals.vslPlayRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslPlayRate),
          week: wAvg(fromM((r) => r.vslPlayRate)),
        },
        {
          key: "vslEngagementRate",
          label: "VSL Engagement Rate",
          format: "percent",
          goal: goals.vslEngagementRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslEngagementRate),
          week: wAvg(fromM((r) => r.vslEngagementRate)),
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
            safeDivide(dPickups(c), dLeads(c) || null) ?? (c.m ? num(c.m.connectionRate) : null),
          week: (days) =>
            safeDivide(
              sum(days.map(dPickups)),
              days.reduce((n, c) => n + dLeads(c), 0) || null
            ),
        },
      ],
    },
  ];
}

export async function buildWeeklyScorecard(
  allMarketing: MarketingDailyMetricRow[],
  allLeads: LeadRow[],
  allEod: BronsonAffiliateEodRow[],
  allCloser: BronsonEodCloserRow[],
  weekStartInput: string | null,
  now: Date = new Date()
): Promise<WeeklyScorecardPayload> {
  const currentWeekStart = sundayOf(todayIso(now));
  const weekStart = weekStartInput ? sundayOf(weekStartInput) : currentWeekStart;
  const dayDates = weekDates(weekStart);
  const weekEnd = dayDates[6];

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

  // Today (and anything later) is still in progress — a partial day would
  // drag the week's rates and totals off. Hold it blank until it closes;
  // it fills in the next day. Past weeks are fully complete, nothing held.
  const todayE = easternDateString(now);

  const dayCtxs: DayCtx[] = dayDates.map((date) => {
    if (date >= todayE) {
      return { date, paidLeads: 0, organicLeads: 0 };
    }
    return {
      date,
      m: byDate.get(date),
      eod: eodByDate.get(date),
      closer: closerByDate.get(date),
      paidLeads: paidByDate.get(date) ?? 0,
      organicLeads: organicByDate.get(date) ?? 0,
    };
  });
  const scoredDays = dayCtxs.filter((c) => c.date < todayE);

  const goals = await getGoals();
  const groups: ScorecardGroup[] = buildSpecs(goals).map((g) => ({
    emoji: g.emoji,
    title: g.title,
    rows: g.metrics.map((spec) => {
      const days: ScorecardCell[] = dayCtxs.map((ctx) => {
        const value = ctx.date >= todayE ? null : spec.day(ctx);
        return { date: ctx.date, value, status: cellStatus(value, spec.goal, spec.goalDirection) };
      });
      const weekValue = spec.week(scoredDays);
      return {
        key: spec.key,
        label: spec.label,
        format: spec.format,
        goal: spec.goal,
        goalDirection: spec.goalDirection,
        days,
        week: { value: weekValue, status: cellStatus(weekValue, spec.goal, spec.goalDirection) },
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
