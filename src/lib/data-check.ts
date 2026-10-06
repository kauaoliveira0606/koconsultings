import { airtableListAll } from "@/lib/airtable/client";
import { rowEasternDate } from "@/lib/airtable/live-cash";
import { parseNumericText } from "@/lib/airtable/parse";
import type { MarketingDailyMetricRow } from "@/lib/airtable/tables";
import {
  addDaysToDateString,
  easternDateString,
  isDateInRange,
  type ResolvedRange,
} from "@/lib/date-range";

/**
 * Data Check: every team log that reports cash is compared, day by day,
 * against the Marketing Daily Metrics form (the dashboard's source of
 * truth). Any day where a log and the form disagree is flagged, including
 * days a log has cash and the form has nothing.
 *
 *   High ticket: Post Call Notes + Follow Up Payment, EOD Closer, Affiliate EOD
 *   Low ticket:  Affiliate PCN, Affiliate EOD
 *
 * Read-only: it never feeds the metrics, it only points at the days to fix.
 */

export type DataCheckMetric = "highTicket" | "lowTicket";

export type DataCheckTable = {
  tableId: string;
  /** Date field the row counts on (defaults to "Date"). */
  dateField?: string;
  /** First non-blank of these fields is the row's cash. */
  cashFields: string[];
  /** Rep who submitted the row; one rep logging twice for a day is called out. */
  repFields?: string[];
};

export type DataCheckSource = {
  label: string;
  metric: DataCheckMetric;
  /** Summed together into one figure (Post Call Notes + Follow Up Payment). */
  tables: DataCheckTable[];
};

export type DataCheckConfig = {
  baseId: string;
  getForm: () => Promise<MarketingDailyMetricRow[]>;
  sources: DataCheckSource[];
};

export type DataCheckFlag = {
  metric: DataCheckMetric;
  source: string;
  sourceCash: number;
  /** null = the form has no entry at all for that day. */
  formCash: number | null;
  /** sourceCash minus the form's figure. */
  diff: number;
  hint: string | null;
};

export type DataCheckDay = {
  date: string;
  formLogged: boolean;
  flags: DataCheckFlag[];
};

export type DataCheckResponse = {
  flagCount: number;
  days: DataCheckDay[];
  /** Latest day checked; today is skipped because it is still being logged. */
  checkedThrough: string;
};

type SourceDay = { cash: number; repeatReps: string[] };

/** Differences under a dollar are rounding, not a mismatch. */
const TOLERANCE = 1;

async function sumSourceByDay(
  baseId: string,
  source: DataCheckSource
): Promise<Map<string, SourceDay>> {
  const byDay = new Map<string, SourceDay>();
  const tables = await Promise.all(
    source.tables.map((t) => airtableListAll<Record<string, unknown>>(baseId, t.tableId))
  );

  tables.forEach((records, i) => {
    const table = source.tables[i];
    const repsSeen = new Map<string, Set<string>>();
    for (const r of records) {
      const date = rowEasternDate(r.fields[table.dateField ?? "Date"], r.createdTime);
      if (!date) continue;
      let amount: number | null = null;
      for (const field of table.cashFields) {
        amount = parseNumericText(r.fields[field]);
        if (amount !== null) break;
      }
      const day = byDay.get(date) ?? { cash: 0, repeatReps: [] };
      byDay.set(date, day);
      if (amount && amount > 0) day.cash += amount;

      const rep = (table.repFields ?? [])
        .map((field) => r.fields[field])
        .find((v): v is string => typeof v === "string" && v.trim() !== "");
      if (rep) {
        const name = rep.trim();
        const seen = repsSeen.get(date) ?? new Set<string>();
        repsSeen.set(date, seen);
        const key = name.toLowerCase();
        if (seen.has(key) && !day.repeatReps.includes(name)) day.repeatReps.push(name);
        seen.add(key);
      }
    }
  });

  return byDay;
}

export async function getDataCheck(
  config: DataCheckConfig,
  range: ResolvedRange
): Promise<DataCheckResponse> {
  const [formRows, ...sourceDays] = await Promise.all([
    config.getForm(),
    ...config.sources.map((s) => sumSourceByDay(config.baseId, s)),
  ]);

  // The getter adds a synthetic "vsl-" row on days VTurb has numbers but the
  // team hasn't submitted the form; those are not form entries.
  const form = new Map<string, Record<DataCheckMetric, number>>();
  for (const row of formRows) {
    if (!row.date || row.id.startsWith("vsl-")) continue;
    const day = form.get(row.date) ?? { highTicket: 0, lowTicket: 0 };
    day.highTicket += row.cashCollectedHighTicket ?? 0;
    day.lowTicket += row.cashCollectedLowTicket ?? 0;
    form.set(row.date, day);
  }

  const today = easternDateString();
  const yesterday = addDaysToDateString(today, -1);
  const dates = new Set<string>(form.keys());
  for (const byDay of sourceDays) for (const date of byDay.keys()) dates.add(date);

  const diffFor = (sourceIndex: number, date: string): number => {
    const source = config.sources[sourceIndex];
    return (sourceDays[sourceIndex].get(date)?.cash ?? 0) - (form.get(date)?.[source.metric] ?? 0);
  };

  const days: DataCheckDay[] = [];
  for (const date of dates) {
    if (!isDateInRange(date, range)) continue;
    // Today is still being logged, and yesterday's form goes in the next
    // day, so neither counts as a mismatch until the form is actually there.
    if (date === today) continue;
    const formDay = form.get(date);
    if (date === yesterday && !formDay) continue;

    const flags: DataCheckFlag[] = [];
    config.sources.forEach((source, i) => {
      const sourceDay = sourceDays[i].get(date);
      const diff = diffFor(i, date);
      if (Math.abs(diff) < TOLERANCE) return;

      let hint: string | null = null;
      if (date > today) {
        hint = "This date is in the future, so an entry was dated wrong.";
      } else if (sourceDay && sourceDay.repeatReps.length > 0) {
        hint = `${sourceDay.repeatReps.join(", ")} submitted more than once for this day.`;
      } else {
        const shifted = [-1, 1]
          .map((offset) => addDaysToDateString(date, offset))
          .find((other) => Math.abs(diffFor(i, other) + diff) < TOLERANCE);
        if (shifted) hint = `Off by the same amount the other way on ${shifted}, so it was likely logged on the wrong day.`;
      }

      flags.push({
        metric: source.metric,
        source: source.label,
        sourceCash: sourceDay?.cash ?? 0,
        formCash: formDay ? formDay[source.metric] : null,
        diff,
        hint,
      });
    });

    if (flags.length > 0) days.push({ date, formLogged: !!formDay, flags });
  }

  days.sort((a, b) => b.date.localeCompare(a.date));
  return {
    flagCount: days.reduce((n, d) => n + d.flags.length, 0),
    days,
    checkedThrough: yesterday,
  };
}
