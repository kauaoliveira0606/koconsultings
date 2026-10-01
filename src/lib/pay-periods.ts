import { addDaysToDateString, easternDateString } from "./date-range";

/**
 * Sales-team pay periods.
 *  - "semimonthly" (Bronson): 1st-15th and 16th-end. Bronson's August 2026 was
 *    paid as Aug 1-21 and Aug 22-31 before that started.
 *  - "weekly" (Aval): Monday to Sunday; the wire goes out the Monday after.
 */

export type PayPeriod = {
  key: string;
  label: string;
  start: string; // inclusive ISO date
  end: string; // inclusive ISO date
  kind: "period" | "month";
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type PayPeriodOptions = {
  /** Defaults to "semimonthly". */
  cadence?: "semimonthly" | "weekly";
  /** First month listed, `YYYY-MM`. */
  firstMonth: string;
  /** Split day for the first month when it wasn't the usual 15th. */
  firstMonthSplitDay?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, month0: number) =>
  new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** Every pay period and whole month up to today (Eastern), newest first. */
export function buildPayPeriods(
  { cadence = "semimonthly", firstMonth, firstMonthSplitDay }: PayPeriodOptions,
  today: string = easternDateString()
): PayPeriod[] {
  const periods: PayPeriod[] = [];
  const weekly = cadence === "weekly";
  const endYear = Number(today.slice(0, 4));
  const endMonth0 = Number(today.slice(5, 7)) - 1;

  let y = Number(firstMonth.slice(0, 4));
  let m = Number(firstMonth.slice(5, 7)) - 1;
  while (y < endYear || (y === endYear && m <= endMonth0)) {
    const ym = `${y}-${pad(m + 1)}`;
    const last = lastDayOfMonth(y, m);
    const split = (ym === firstMonth && firstMonthSplitDay) || 15;
    const halves: [number, number][] = [
      [1, split],
      [split + 1, last],
    ];
    for (const [from, to] of weekly ? [] : halves) {
      const start = `${ym}-${pad(from)}`;
      if (start > today) continue;
      periods.push({
        key: start,
        label: `${MONTHS[m]} ${from} - ${to}, ${y}`,
        start,
        end: `${ym}-${pad(to)}`,
        kind: "period",
      });
    }
    periods.push({
      key: ym,
      label: `${MONTHS[m]} ${y} (full month)`,
      start: `${ym}-01`,
      end: `${ym}-${pad(last)}`,
      kind: "month",
    });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  periods.reverse();
  return weekly ? [...buildWeeks(`${firstMonth}-01`, today), ...periods] : periods;
}

function mondayOf(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDaysToDateString(ymd, dow === 0 ? -6 : 1 - dow);
}

function shortDay(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

/** Monday-Sunday weeks from the week containing `from` through this week, newest first. */
function buildWeeks(from: string, today: string): PayPeriod[] {
  const weeks: PayPeriod[] = [];
  for (let start = mondayOf(today); start >= mondayOf(from); start = addDaysToDateString(start, -7)) {
    const end = addDaysToDateString(start, 6);
    weeks.push({
      key: start,
      label: `${shortDay(start)} - ${shortDay(end)}, ${end.slice(0, 4)}`,
      start,
      end,
      kind: "period",
    });
  }
  return weeks;
}
