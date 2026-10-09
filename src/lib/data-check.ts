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
 * truth). Cash that a log and the form disagree on is flagged, including
 * cash a log has and the form never recorded. The same cash showing up a day
 * or two apart (late financing payments) is not a mismatch.
 *
 *   High ticket: Post Call Notes + Follow Up Payment, EOD Closer, Affiliate EOD
 *   Low ticket:  Affiliate PCN, Affiliate EOD
 *
 * It also flags duplicate records: the same thing submitted more than once in
 * a log (same lead, day and cash; or the same rep's end of day report twice),
 * and days with more than one Daily Metrics form entry.
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

/** One log to scan for the same record submitted more than once. */
export type DuplicateCheck = {
  label: string;
  tableId: string;
  /** Date field the row counts on (defaults to "Date"). */
  dateField?: string;
  /**
   * What makes two rows the same record, besides the day: for each group the
   * first non-blank field is used (lead email, else lead name). A row with
   * nothing in the first group is skipped.
   */
  identity: string[][];
  /** When set, the cash must match too, and the double counted cash is reported. */
  cashFields?: string[];
  /** Name shown for the record (first non-blank); falls back to the identity. */
  displayFields?: string[];
};

export type DataCheckConfig = {
  baseId: string;
  getForm: () => Promise<MarketingDailyMetricRow[]>;
  sources: DataCheckSource[];
  duplicateChecks?: DuplicateCheck[];
  /** The form's own table, so repeated form entries can link to their records. */
  formTableId?: string;
};

/** One copy of a repeated record, with where to find it in Airtable. */
export type DuplicateRecord = {
  id: string;
  url: string | null;
  /** When it was submitted (ISO), null if unknown. */
  submittedAt: string | null;
};

export type DataCheckDuplicate = {
  source: string;
  date: string;
  /** The lead or rep the repeated record is about; null for the form itself. */
  who: string | null;
  /** How many times it was submitted. */
  count: number;
  /** Cash on each copy, when the log is matched on cash. */
  cash: number | null;
  /** Cash counted more than once because of the copies. */
  extraCash: number;
  /** Every copy, oldest first. */
  records: DuplicateRecord[];
};

export type DataCheckFlag = {
  metric: DataCheckMetric;
  source: string;
  sourceCash: number;
  /** null = the form has no entry at all for that day. */
  formCash: number | null;
  /** Cash still unaccounted for (positive = the log has more than the form),
   * after cancelling against opposite gaps on nearby days. */
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
  /** Records submitted more than once, newest first. */
  duplicates: DataCheckDuplicate[];
  /** Latest day checked; today is skipped because it is still being logged. */
  checkedThrough: string;
};

type SourceDay = { cash: number; repeatReps: string[] };

/** Differences under a dollar are rounding, not a mismatch. */
const TOLERANCE = 1;

/** How many days apart the same cash can sit in a log and in the form. */
const MATCH_WINDOW_DAYS = 2;

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

const airtableRecordUrl = (baseId: string, tableId: string, recordId: string) =>
  `https://airtable.com/${baseId}/${tableId}/${recordId}`;

const firstText = (fields: Record<string, unknown>, names: string[]): string | null => {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
};

async function findDuplicates(
  baseId: string,
  check: DuplicateCheck,
  range: ResolvedRange
): Promise<DataCheckDuplicate[]> {
  const records = await airtableListAll<Record<string, unknown>>(baseId, check.tableId);
  const groups = new Map<string, DataCheckDuplicate>();
  for (const r of records) {
    const date = rowEasternDate(r.fields[check.dateField ?? "Date"], r.createdTime);
    if (!date || !isDateInRange(date, range)) continue;
    const parts = check.identity.map((group) => firstText(r.fields, group));
    if (!parts[0]) continue;
    let cash: number | null = null;
    for (const field of check.cashFields ?? []) {
      cash = parseNumericText(r.fields[field]);
      if (cash !== null) break;
    }
    const key = [date, ...parts.map((p) => (p ?? "").toLowerCase()), check.cashFields ? cash ?? 0 : ""].join("|");
    const group = groups.get(key);
    const record: DuplicateRecord = {
      id: r.id,
      url: airtableRecordUrl(baseId, check.tableId, r.id),
      submittedAt: r.createdTime || null,
    };
    if (group) {
      group.count += 1;
      group.extraCash += cash ?? 0;
      group.records.push(record);
    } else {
      groups.set(key, {
        source: check.label,
        date,
        who: firstText(r.fields, check.displayFields ?? []) ?? parts[0],
        count: 1,
        cash: check.cashFields ? cash ?? 0 : null,
        extraCash: 0,
        records: [record],
      });
    }
  }
  const duplicates = [...groups.values()].filter((g) => g.count > 1);
  for (const d of duplicates) {
    d.records.sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  }
  return duplicates;
}

export async function getDataCheck(
  config: DataCheckConfig,
  range: ResolvedRange
): Promise<DataCheckResponse> {
  const [formRows, duplicateLists, ...sourceDays] = await Promise.all([
    config.getForm(),
    Promise.all((config.duplicateChecks ?? []).map((c) => findDuplicates(config.baseId, c, range))),
    ...config.sources.map((s) => sumSourceByDay(config.baseId, s)),
  ]);
  const duplicates = duplicateLists.flat();

  // The getter adds a synthetic "vsl-" row on days VTurb has numbers but the
  // team hasn't submitted the form; those are not form entries.
  const form = new Map<string, Record<DataCheckMetric, number>>();
  const formEntries = new Map<string, DuplicateRecord[]>();
  for (const row of formRows) {
    if (!row.date || row.id.startsWith("vsl-")) continue;
    formEntries.set(row.date, [
      ...(formEntries.get(row.date) ?? []),
      {
        id: row.id,
        url: config.formTableId ? airtableRecordUrl(config.baseId, config.formTableId, row.id) : null,
        submittedAt: null,
      },
    ]);
    const day = form.get(row.date) ?? { highTicket: 0, lowTicket: 0 };
    day.highTicket += row.cashCollectedHighTicket ?? 0;
    day.lowTicket += row.cashCollectedLowTicket ?? 0;
    form.set(row.date, day);
  }

  const today = easternDateString();
  const yesterday = addDaysToDateString(today, -1);
  const allDates = new Set<string>(form.keys());
  for (const byDay of sourceDays) for (const date of byDay.keys()) allDates.add(date);
  // Today is still being logged, and yesterday's form goes in the next day,
  // so neither counts until the form is actually there.
  const dates = [...allDates]
    .filter((date) => date !== today && !(date === yesterday && !form.has(date)))
    .sort();

  // What matters is that the cash cross-matches, not which day it landed on:
  // financing (Clarity) payments arrive a day or two after the sale, so one
  // log can carry the cash on a different day than the form. A gap on one day
  // is cancelled against an opposite gap up to MATCH_WINDOW_DAYS later, and
  // only what is left unaccounted for is flagged.
  const gaps = config.sources.map((source, i) => {
    const left = new Map<string, number>();
    const matchedWith = new Map<string, string[]>();
    for (const date of dates) {
      left.set(
        date,
        (sourceDays[i].get(date)?.cash ?? 0) - (form.get(date)?.[source.metric] ?? 0)
      );
    }
    for (const date of dates) {
      for (let offset = 1; offset <= MATCH_WINDOW_DAYS; offset++) {
        const gap = left.get(date) ?? 0;
        const other = addDaysToDateString(date, offset);
        const otherGap = left.get(other) ?? 0;
        if (Math.abs(gap) < TOLERANCE || Math.abs(otherGap) < TOLERANCE) continue;
        if (Math.sign(gap) === Math.sign(otherGap)) continue;
        const cancelled = Math.min(Math.abs(gap), Math.abs(otherGap));
        left.set(date, gap - Math.sign(gap) * cancelled);
        left.set(other, otherGap - Math.sign(otherGap) * cancelled);
        matchedWith.set(date, [...(matchedWith.get(date) ?? []), other]);
        matchedWith.set(other, [...(matchedWith.get(other) ?? []), date]);
      }
    }
    return { left, matchedWith };
  });

  const stillOpenFrom = addDaysToDateString(today, -MATCH_WINDOW_DAYS);
  const days: DataCheckDay[] = [];
  for (const date of dates) {
    if (!isDateInRange(date, range)) continue;
    const formDay = form.get(date);

    const flags: DataCheckFlag[] = [];
    config.sources.forEach((source, i) => {
      const sourceDay = sourceDays[i].get(date);
      const diff = gaps[i].left.get(date) ?? 0;
      if (Math.abs(diff) < TOLERANCE) return;

      const hints: string[] = [];
      const matched = gaps[i].matchedWith.get(date);
      if (matched) {
        hints.push(`Part of this day's gap is covered by ${matched.join(" and ")}; this is what is left.`);
      }
      if (date > today) {
        hints.push("This date is in the future, so an entry was dated wrong.");
      } else if (sourceDay && sourceDay.repeatReps.length > 0) {
        hints.push(`${sourceDay.repeatReps.join(", ")} submitted more than once for this day.`);
      } else if (date >= stillOpenFrom) {
        hints.push("Recent, so this can still clear if the cash lands a day or two late.");
      }

      flags.push({
        metric: source.metric,
        source: source.label,
        sourceCash: sourceDay?.cash ?? 0,
        formCash: formDay ? formDay[source.metric] : null,
        diff,
        hint: hints.length > 0 ? hints.join(" ") : null,
      });
    });

    if (flags.length > 0) days.push({ date, formLogged: !!formDay, flags });
  }

  // More than one form entry for a day: they are added together, so a
  // resubmission doubles that day's numbers.
  for (const [date, records] of formEntries) {
    if (records.length > 1 && isDateInRange(date, range)) {
      duplicates.push({
        source: "Daily Metrics form",
        date,
        who: null,
        count: records.length,
        cash: null,
        extraCash: 0,
        records,
      });
    }
  }
  duplicates.sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source));

  days.sort((a, b) => b.date.localeCompare(a.date));
  return {
    flagCount: days.reduce((n, d) => n + d.flags.length, 0),
    days,
    duplicates,
    checkedThrough: yesterday,
  };
}
