import type { StatFormat } from "./format";
import type { LeadRow, MarketingDailyMetricRow } from "./airtable/tables";
import { isOrganicSource, isPaidSource } from "./airtable/lead-source-lookup";
import { easternDateString } from "./date-range";
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
  // lower is better
  if (actual <= goal) return "green";
  if (actual <= goal * 1.2) return "yellow";
  return "red";
}

/** What a single day's cell gets to see. */
type DayCtx = {
  date: string;
  /** the Marketing Daily Metrics row for this day, if one was submitted */
  m?: MarketingDailyMetricRow;
  /** Paid / Organic lead counts for this day, from the Airtable Leads table */
  paidLeads: number;
  organicLeads: number;
};

/** What the WEEK column gets to see. */
type WeekCtx = {
  rows: MarketingDailyMetricRow[];
  paidLeads: number;
  organicLeads: number;
};

type MetricSpec = {
  key: string;
  label: string;
  format: StatFormat;
  goal: number | null;
  goalDirection: GoalDirection | null;
  day: (c: DayCtx) => number | null;
  week: (c: WeekCtx) => number | null;
};

const totalCashOf = (r: MarketingDailyMetricRow): number | null => {
  if (r.cashCollectedLowTicket === null && r.cashCollectedHighTicket === null) return null;
  return (r.cashCollectedLowTicket ?? 0) + (r.cashCollectedHighTicket ?? 0);
};

/** Wrap a Marketing-row accessor so it yields null on days with no submission. */
const fromM =
  (pick: (r: MarketingDailyMetricRow) => number | null) =>
  (c: DayCtx): number | null =>
    c.m ? pick(c.m) : null;

function buildSpecs(goals: Awaited<ReturnType<typeof getGoals>>): {
  emoji: string;
  title: string;
  metrics: MetricSpec[];
}[] {
  const sumOf = (pick: (r: MarketingDailyMetricRow) => number | null) => (c: WeekCtx) =>
    sum(c.rows.map(pick));
  const avgOf = (pick: (r: MarketingDailyMetricRow) => number | null) => (c: WeekCtx) =>
    average(c.rows.map(pick));

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
          day: fromM((r) => r.adSpendMeta),
          week: sumOf((r) => r.adSpendMeta),
        },
        {
          key: "costPerLeadMeta",
          label: "Cost Per Lead (Meta)",
          format: "currency",
          goal: goals.costPerLeadMeta?.max ?? null,
          goalDirection: "lower",
          day: fromM((r) => r.costPerLeadMeta),
          // Cost per *paid* lead — ad spend buys paid leads, not organic ones.
          week: (c) => safeDivide(sum(c.rows.map((r) => r.adSpendMeta)), c.paidLeads || null),
        },
        {
          key: "cashCollectedLowTicket",
          label: "Cash Collected – Low Ticket",
          format: "currency",
          goal: goals.cashCollectedLowTicket,
          goalDirection: goals.cashCollectedLowTicket === null ? null : "higher",
          day: fromM((r) => r.cashCollectedLowTicket),
          week: sumOf((r) => r.cashCollectedLowTicket),
        },
        {
          key: "funnelConversionRate",
          label: "Funnel Conversion Rate",
          format: "percent",
          goal: goals.funnelConversionRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.funnelConversionRate),
          week: avgOf((r) => r.funnelConversionRate),
        },
        {
          key: "roasTotal",
          label: "ROAS – Total",
          format: "ratio",
          goal: goals.roasTotal?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => roas(totalCashOf(r), r.adSpendMeta)),
          week: (c) => roas(sum(c.rows.map(totalCashOf)), sum(c.rows.map((r) => r.adSpendMeta))),
        },
        {
          key: "cpaLowTicket",
          label: "CPA – Low Ticket",
          format: "currency",
          goal: goals.cpaLowTicket?.max ?? null,
          goalDirection: "lower",
          day: fromM((r) => safeDivide(r.adSpendMeta, r.salesLowTicket)),
          week: (c) =>
            safeDivide(sum(c.rows.map((r) => r.adSpendMeta)), sum(c.rows.map((r) => r.salesLowTicket))),
        },
        {
          key: "totalCashCollected",
          label: "Total Cash Collected",
          format: "currency",
          goal: goals.totalCashCollected,
          goalDirection: goals.totalCashCollected === null ? null : "higher",
          day: fromM(totalCashOf),
          week: sumOf(totalCashOf),
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
          // Sourced from the Airtable Leads table (Source = Paid), same as
          // the Lead Sources section — not the Marketing Daily Metrics form.
          day: (c) => (c.paidLeads > 0 || c.m ? c.paidLeads : null),
          week: (c) => c.paidLeads,
        },
        {
          key: "optInsOrganic",
          label: "Opt-Ins (Organic)",
          format: "number",
          goal: goals.optInsOrganic,
          goalDirection: goals.optInsOrganic === null ? null : "higher",
          day: (c) => (c.organicLeads > 0 || c.m ? c.organicLeads : null),
          week: (c) => c.organicLeads,
        },
        {
          key: "vslViews",
          label: "VSL Views",
          format: "number",
          goal: goals.vslViews,
          goalDirection: goals.vslViews === null ? null : "higher",
          day: fromM((r) => r.vslViews),
          week: sumOf((r) => r.vslViews),
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
          day: fromM((r) => r.dials),
          week: sumOf((r) => r.dials),
        },
        {
          key: "salesLowTicket",
          label: "Sales – Low Ticket",
          format: "number",
          goal: goals.salesLowTicket,
          goalDirection: goals.salesLowTicket === null ? null : "higher",
          day: fromM((r) => r.salesLowTicket),
          week: sumOf((r) => r.salesLowTicket),
        },
        {
          key: "closeRateLowTicket",
          label: "Close Rate – Low Ticket",
          format: "percent",
          goal: goals.closeRateLowTicket?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.closeRateLowTicket),
          week: avgOf((r) => r.closeRateLowTicket),
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
          week: avgOf((r) => r.landingPageConnectRate),
        },
        {
          key: "optInRate",
          label: "Opt-In Rate (Opt-Ins vs Views)",
          format: "percent",
          goal: goals.optInRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.optInRate),
          week: avgOf((r) => r.optInRate),
        },
        {
          key: "vslPlayRate",
          label: "VSL Play Rate",
          format: "percent",
          goal: goals.vslPlayRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslPlayRate),
          week: avgOf((r) => r.vslPlayRate),
        },
        {
          key: "vslEngagementRate",
          label: "VSL Engagement Rate",
          format: "percent",
          goal: goals.vslEngagementRate?.min ?? null,
          goalDirection: "higher",
          day: fromM((r) => r.vslEngagementRate),
          week: avgOf((r) => r.vslEngagementRate),
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
          day: fromM((r) => r.connectionRate),
          week: avgOf((r) => r.connectionRate),
        },
      ],
    },
  ];
}

export async function buildWeeklyScorecard(
  allMarketing: MarketingDailyMetricRow[],
  allLeads: LeadRow[],
  weekStartInput: string | null,
  now: Date = new Date()
): Promise<WeeklyScorecardPayload> {
  const currentWeekStart = sundayOf(todayIso(now));
  const weekStart = weekStartInput ? sundayOf(weekStartInput) : currentWeekStart;
  const dayDates = weekDates(weekStart);
  const weekEnd = dayDates[6];

  const byDate = new Map(allMarketing.filter((r) => r.date).map((r) => [r.date as string, r]));
  const inWeekRows = dayDates
    .map((d) => byDate.get(d))
    .filter((r): r is MarketingDailyMetricRow => !!r);

  // Per-day Paid / Organic lead counts from the Leads table (dated by Created At).
  const paidByDate = new Map<string, number>();
  const organicByDate = new Map<string, number>();
  for (const lead of allLeads) {
    if (!lead.createdAt) continue;
    if (isPaidSource(lead.source)) {
      paidByDate.set(lead.createdAt, (paidByDate.get(lead.createdAt) ?? 0) + 1);
    } else if (isOrganicSource(lead.source)) {
      organicByDate.set(lead.createdAt, (organicByDate.get(lead.createdAt) ?? 0) + 1);
    }
  }
  const weekPaidLeads = dayDates.reduce((n, d) => n + (paidByDate.get(d) ?? 0), 0);
  const weekOrganicLeads = dayDates.reduce((n, d) => n + (organicByDate.get(d) ?? 0), 0);
  const weekCtx: WeekCtx = {
    rows: inWeekRows,
    paidLeads: weekPaidLeads,
    organicLeads: weekOrganicLeads,
  };

  const goals = await getGoals();
  const groups: ScorecardGroup[] = buildSpecs(goals).map((g) => ({
    emoji: g.emoji,
    title: g.title,
    rows: g.metrics.map((spec) => {
      const days: ScorecardCell[] = dayDates.map((date) => {
        const ctx: DayCtx = {
          date,
          m: byDate.get(date),
          paidLeads: paidByDate.get(date) ?? 0,
          organicLeads: organicByDate.get(date) ?? 0,
        };
        const value = spec.day(ctx);
        return { date, value, status: cellStatus(value, spec.goal, spec.goalDirection) };
      });
      const weekValue = spec.week(weekCtx);
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
