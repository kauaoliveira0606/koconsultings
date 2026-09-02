import type { StatFormat } from "./format";
import type { MarketingDailyMetricRow } from "./airtable/tables";
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
  return now.toISOString().slice(0, 10);
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

type MetricSpec = {
  key: string;
  label: string;
  format: StatFormat;
  goal: number | null;
  goalDirection: GoalDirection | null;
  /** per-day value from that day's row */
  day: (r: MarketingDailyMetricRow) => number | null;
  /** week aggregate across the 7 in-week rows */
  week: (rows: MarketingDailyMetricRow[]) => number | null;
};

const totalCashOf = (r: MarketingDailyMetricRow): number | null => {
  if (r.cashCollectedLowTicket === null && r.cashCollectedHighTicket === null) return null;
  return (r.cashCollectedLowTicket ?? 0) + (r.cashCollectedHighTicket ?? 0);
};

function buildSpecs(goals: Awaited<ReturnType<typeof getGoals>>): {
  emoji: string;
  title: string;
  metrics: MetricSpec[];
}[] {
  const sumOf = (pick: (r: MarketingDailyMetricRow) => number | null) => (rows: MarketingDailyMetricRow[]) =>
    sum(rows.map(pick));
  const avgOf = (pick: (r: MarketingDailyMetricRow) => number | null) => (rows: MarketingDailyMetricRow[]) =>
    average(rows.map(pick));

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
          day: (r) => r.adSpendMeta,
          week: sumOf((r) => r.adSpendMeta),
        },
        {
          key: "costPerLeadMeta",
          label: "Cost Per Lead (Meta)",
          format: "currency",
          goal: goals.costPerLeadMeta?.max ?? null,
          goalDirection: "lower",
          day: (r) => r.costPerLeadMeta,
          // Cost per *paid* lead — ad spend buys paid opt-ins, not organic ones.
          week: (rows) =>
            safeDivide(sum(rows.map((r) => r.adSpendMeta)), sum(rows.map((r) => r.optInsPaid))),
        },
        {
          key: "cashCollectedLowTicket",
          label: "Cash Collected – Low Ticket",
          format: "currency",
          goal: goals.cashCollectedLowTicket,
          goalDirection: goals.cashCollectedLowTicket === null ? null : "higher",
          day: (r) => r.cashCollectedLowTicket,
          week: sumOf((r) => r.cashCollectedLowTicket),
        },
        {
          key: "funnelConversionRate",
          label: "Funnel Conversion Rate",
          format: "percent",
          goal: goals.funnelConversionRate?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.funnelConversionRate,
          week: avgOf((r) => r.funnelConversionRate),
        },
        {
          key: "roasTotal",
          label: "ROAS – Total",
          format: "ratio",
          goal: goals.roasTotal?.min ?? null,
          goalDirection: "higher",
          day: (r) => roas(totalCashOf(r), r.adSpendMeta),
          week: (rows) => roas(sum(rows.map(totalCashOf)), sum(rows.map((r) => r.adSpendMeta))),
        },
        {
          key: "cpaLowTicket",
          label: "CPA – Low Ticket",
          format: "currency",
          goal: goals.cpaLowTicket?.max ?? null,
          goalDirection: "lower",
          day: (r) => safeDivide(r.adSpendMeta, r.salesLowTicket),
          week: (rows) =>
            safeDivide(sum(rows.map((r) => r.adSpendMeta)), sum(rows.map((r) => r.salesLowTicket))),
        },
        {
          key: "totalCashCollected",
          label: "Total Cash Collected",
          format: "currency",
          goal: goals.totalCashCollected,
          goalDirection: goals.totalCashCollected === null ? null : "higher",
          day: totalCashOf,
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
          day: (r) => r.optInsPaid,
          week: sumOf((r) => r.optInsPaid),
        },
        {
          key: "optInsOrganic",
          label: "Opt-Ins (Organic)",
          format: "number",
          goal: goals.optInsOrganic,
          goalDirection: goals.optInsOrganic === null ? null : "higher",
          day: (r) => r.optInsOrganic,
          week: sumOf((r) => r.optInsOrganic),
        },
        {
          key: "vslViews",
          label: "VSL Views",
          format: "number",
          goal: goals.vslViews,
          goalDirection: goals.vslViews === null ? null : "higher",
          day: (r) => r.vslViews,
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
          day: (r) => r.dials,
          week: sumOf((r) => r.dials),
        },
        {
          key: "salesLowTicket",
          label: "Sales – Low Ticket",
          format: "number",
          goal: goals.salesLowTicket,
          goalDirection: goals.salesLowTicket === null ? null : "higher",
          day: (r) => r.salesLowTicket,
          week: sumOf((r) => r.salesLowTicket),
        },
        {
          key: "closeRateLowTicket",
          label: "Close Rate – Low Ticket",
          format: "percent",
          goal: goals.closeRateLowTicket?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.closeRateLowTicket,
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
          day: (r) => r.landingPageConnectRate,
          week: avgOf((r) => r.landingPageConnectRate),
        },
        {
          key: "optInRate",
          label: "Opt-In Rate (Opt-Ins vs Views)",
          format: "percent",
          goal: goals.optInRate?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.optInRate,
          week: avgOf((r) => r.optInRate),
        },
        {
          key: "vslPlayRate",
          label: "VSL Play Rate",
          format: "percent",
          goal: goals.vslPlayRate?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.vslPlayRate,
          week: avgOf((r) => r.vslPlayRate),
        },
        {
          key: "vslEngagementRate",
          label: "VSL Engagement Rate",
          format: "percent",
          goal: goals.vslEngagementRate?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.vslEngagementRate,
          week: avgOf((r) => r.vslEngagementRate),
        },
        {
          key: "confirmationEmailOpenRate",
          label: "Confirmation Email Open Rate",
          format: "percent",
          goal: goals.confirmationEmailOpenRate?.min ?? null,
          goalDirection: "higher",
          day: (r) => r.confirmationEmailOpenRate,
          week: avgOf((r) => r.confirmationEmailOpenRate),
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
          day: (r) => r.connectionRate,
          week: avgOf((r) => r.connectionRate),
        },
      ],
    },
  ];
}

export async function buildWeeklyScorecard(
  allMarketing: MarketingDailyMetricRow[],
  weekStartInput: string | null,
  now: Date = new Date()
): Promise<WeeklyScorecardPayload> {
  const currentWeekStart = sundayOf(todayIso(now));
  const weekStart = weekStartInput ? sundayOf(weekStartInput) : currentWeekStart;
  const dayDates = weekDates(weekStart);
  const weekEnd = dayDates[6];

  const byDate = new Map(allMarketing.filter((r) => r.date).map((r) => [r.date as string, r]));
  const inWeekRows = dayDates.map((d) => byDate.get(d)).filter((r): r is MarketingDailyMetricRow => !!r);

  const goals = await getGoals();
  const groups: ScorecardGroup[] = buildSpecs(goals).map((g) => ({
    emoji: g.emoji,
    title: g.title,
    rows: g.metrics.map((spec) => {
      const days: ScorecardCell[] = dayDates.map((date) => {
        const row = byDate.get(date);
        const value = row ? spec.day(row) : null;
        return { date, value, status: cellStatus(value, spec.goal, spec.goalDirection) };
      });
      const weekValue = spec.week(inWeekRows);
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
