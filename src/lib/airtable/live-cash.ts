import { airtableListAll } from "./client";
import { parseDateOnly, parseNumericText } from "./parse";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";

/**
 * Live "cash so far today" read ONLY from the three per-sale logs the team
 * fills in as money comes in: Post Call Notes (high ticket), Affiliate PCN
 * (software CPA) and Follow Up Payment (later installments). Nothing else
 * feeds it, and it feeds nothing else — the historical metrics stay form-first.
 */

export type LiveCashSource = {
  baseId: string;
  tableId: string;
  /** Date field the row counts on (defaults to "Date"). */
  dateField?: string;
  /** First non-blank of these fields is the row's cash. */
  cashFields: string[];
  /** Drop repeat rows sharing this field's value (Ecom PCN double-submits). */
  dedupeField?: string;
};

export type LiveCashSourceTotal = {
  cash: number;
  entries: number;
  lastEntryAt: string | null;
};

export type LiveCashResponse = {
  date: string;
  total: number;
  postCallNotes: LiveCashSourceTotal;
  affiliatePcn: LiveCashSourceTotal;
  followUpPayments: LiveCashSourceTotal;
  fetchedAt: string;
};

/**
 * Some forms stamp Date with the UTC day, so an 8pm+ ET submission reads as
 * tomorrow. When Date is exactly the UTC day the record was created, trust
 * the Eastern day of the creation time instead (same rule as lead opt-ins).
 */
function rowEasternDate(dateField: unknown, createdTime: string): string | null {
  const date = parseDateOnly(dateField);
  if (date && createdTime && date === createdTime.slice(0, 10)) {
    return toEasternDateOnly(createdTime);
  }
  return date;
}

async function sumSourceForDay(source: LiveCashSource, day: string): Promise<LiveCashSourceTotal> {
  const records = await airtableListAll<Record<string, unknown>>(source.baseId, source.tableId);
  const seen = new Set<string>();
  let cash = 0;
  let entries = 0;
  let lastEntryAt: string | null = null;

  for (const r of records) {
    if (rowEasternDate(r.fields[source.dateField ?? "Date"], r.createdTime) !== day) continue;
    if (source.dedupeField) {
      const key = r.fields[source.dedupeField];
      if (typeof key === "string" && key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
    }
    let amount: number | null = null;
    for (const field of source.cashFields) {
      amount = parseNumericText(r.fields[field]);
      if (amount !== null) break;
    }
    if (!amount || amount <= 0) continue;
    cash += amount;
    entries += 1;
    if (!lastEntryAt || r.createdTime > lastEntryAt) lastEntryAt = r.createdTime;
  }

  return { cash, entries, lastEntryAt };
}

export async function getLiveCashToday(sources: {
  postCallNotes: LiveCashSource;
  affiliatePcn: LiveCashSource;
  followUpPayments: LiveCashSource;
}): Promise<LiveCashResponse> {
  const date = easternDateString();
  const [postCallNotes, affiliatePcn, followUpPayments] = await Promise.all([
    sumSourceForDay(sources.postCallNotes, date),
    sumSourceForDay(sources.affiliatePcn, date),
    sumSourceForDay(sources.followUpPayments, date),
  ]);
  return {
    date,
    total: postCallNotes.cash + affiliatePcn.cash + followUpPayments.cash,
    postCallNotes,
    affiliatePcn,
    followUpPayments,
    fetchedAt: new Date().toISOString(),
  };
}
