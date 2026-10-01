import { easternDateString } from "./date-range";

/**
 * Sales-team pay periods: twice a month (1st-15th, 16th-end). Bronson's
 * August 2026 was paid as Aug 1-21 and Aug 22-31 before that started.
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
  { firstMonth, firstMonthSplitDay }: PayPeriodOptions,
  today: string = easternDateString()
): PayPeriod[] {
  const periods: PayPeriod[] = [];
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
    for (const [from, to] of halves) {
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
  return periods.reverse();
}
