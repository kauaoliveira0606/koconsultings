/**
 * Shared logic for the Base44/Wix affiliate "Attribution Rate" — the share of
 * the team's logged closes that the affiliate portal actually tracked (and
 * will pay on). It lives in its own dashboard section rather than the metrics
 * grid because the portal only reports monthly before Sep 2026 and weekly
 * from Sep 2026 on, so it can't be sliced by the shared day/week range filter.
 *
 * Numerator:   Purchases from "Affiliate Portal Daily" (synced from the portal).
 * Denominator: rows in the team's "Affiliate PCN" close log.
 * Both are filtered to the given brands and to on/after `dataFloor`.
 *
 * Two per-offer dates:
 *  - periodsFrom: which period buckets to list (Bronson Aug 2026; Aval Sep 2026).
 *  - dataFloor:   earliest close/purchase date that counts. The oldest bucket is
 *    stretched back to it, so closes the team back-dates a day or two into the
 *    previous month/week (e.g. Aval's first four closes, dated Aug 31 but logged
 *    Sep 1) still land in the first real period instead of a throwaway bucket.
 */

export const ATTRIBUTION_START_DATE = "2026-08-01";
/** The date the portal switched Base44/Wix from monthly to weekly payouts. */
const PORTAL_WENT_WEEKLY = "2026-09-01";

export type AttributionGranularity = "month" | "week";

export type AttributionPeriod = {
  key: string;
  label: string;
  start: string; // inclusive ISO date
  end: string; // inclusive ISO date
};

export type AttributionBucket = AttributionPeriod & {
  portalPurchases: number | null;
  pcnCloses: number | null;
  rate: number | null;
};

type DatedBrandRow = { date: string | null; brand?: string | null; software?: string | null };
type PortalRow = { date: string | null; brand: string | null; purchases: number | null };

const normalizeBrand = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const brandMatcher = (brands: string[]) => {
  const set = new Set(brands.map(normalizeBrand));
  return (value: string | null | undefined): boolean => set.has(normalizeBrand(value));
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}
function endOfMonthUTC(year: number, month0: number): string {
  return iso(new Date(Date.UTC(year, month0 + 1, 0)));
}
/** Monday of the week containing `d` (portal payout weeks run Mon–Sun). */
function mondayOf(d: Date): Date {
  const dow = d.getUTCDay(); // 0 = Sun
  return addDaysUTC(d, dow === 0 ? -6 : 1 - dow);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type BuildPeriodsOptions = {
  /** Month/week of the first listed bucket. Defaults to ATTRIBUTION_START_DATE. */
  periodsFrom?: string;
  /** Earliest date whose data counts; the oldest bucket stretches back to it. */
  dataFloor?: string;
  now?: Date;
};

/**
 * Every selectable period, newest first. Months run from `periodsFrom`'s month
 * to the current month; weeks (Mon–Sun) run from the week containing the later
 * of `periodsFrom` and the portal's weekly-payout switch to the current week.
 * The oldest bucket's `start` is pulled back to `dataFloor`.
 */
export function buildAttributionPeriods(
  granularity: AttributionGranularity,
  { periodsFrom = ATTRIBUTION_START_DATE, dataFloor = periodsFrom, now = new Date() }: BuildPeriodsOptions = {}
): AttributionPeriod[] {
  const start = new Date(`${periodsFrom}T00:00:00Z`);
  const periods: AttributionPeriod[] = [];

  if (granularity === "month") {
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    const endY = now.getUTCFullYear();
    const endM = now.getUTCMonth();
    while (y < endY || (y === endY && m <= endM)) {
      periods.push({
        key: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: `${MONTHS[m]} ${y}`,
        start: iso(new Date(Date.UTC(y, m, 1))),
        end: endOfMonthUTC(y, m),
      });
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  } else {
    const weeklyFrom = periodsFrom > PORTAL_WENT_WEEKLY ? periodsFrom : PORTAL_WENT_WEEKLY;
    let weekStart = mondayOf(new Date(`${weeklyFrom}T00:00:00Z`));
    const lastMonday = mondayOf(now);
    while (weekStart <= lastMonday) {
      const weekEnd = addDaysUTC(weekStart, 6);
      periods.push({
        key: iso(weekStart),
        label:
          `${MONTHS[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()} – ` +
          `${MONTHS[weekEnd.getUTCMonth()]} ${weekEnd.getUTCDate()}, ${weekEnd.getUTCFullYear()}`,
        start: iso(weekStart),
        end: iso(weekEnd),
      });
      weekStart = addDaysUTC(weekStart, 7);
    }
  }

  // Fold a short back-dated tail into the first listed bucket — e.g. Aval's
  // first four closes are dated Aug 31 but belong to September. Only stretch
  // when the gap is small (≤ 10 days); never absorb a whole prior period.
  if (periods.length > 0 && dataFloor < periods[0].start) {
    const gapDays =
      (Date.parse(`${periods[0].start}T00:00:00Z`) - Date.parse(`${dataFloor}T00:00:00Z`)) /
      86_400_000;
    if (gapDays <= 10) periods[0] = { ...periods[0], start: dataFloor };
  }
  return periods.reverse();
}

function inClosedRange(date: string | null, start: string, end: string, floor: string): boolean {
  if (!date || date < floor) return false;
  return date >= start && date <= end;
}

export function computeAttributionBuckets(
  periods: AttributionPeriod[],
  portalRows: PortalRow[],
  pcnRows: DatedBrandRow[],
  brands: string[],
  dataFloor: string = ATTRIBUTION_START_DATE
): AttributionBucket[] {
  const matches = brandMatcher(brands);
  const portal = portalRows.filter((r) => matches(r.brand));
  const pcn = pcnRows.filter((r) => matches(r.brand ?? r.software));

  return periods.map((p) => {
    const portalPurchases = portal
      .filter((r) => inClosedRange(r.date, p.start, p.end, dataFloor))
      .reduce((sum, r) => sum + (r.purchases ?? 0), 0);
    const pcnCloses = pcn.filter((r) => inClosedRange(r.date, p.start, p.end, dataFloor)).length;
    const rate = pcnCloses > 0 ? portalPurchases / pcnCloses : null;
    return { ...p, portalPurchases, pcnCloses, rate };
  });
}
