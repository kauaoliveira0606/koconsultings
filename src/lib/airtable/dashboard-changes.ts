import { AirtableError } from "@/lib/airtable/client";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/**
 * "Dashboard Changes" table in each offer's base: the daily "changes made"
 * note typed straight into the Overview page's Recent Changes section, one
 * row per day (Date + Changes). Replaces logging it through the Marketing
 * Daily Metrics form — kept in its own table so a note never creates a
 * half-empty Marketing Daily Metrics row that would skew the metric math.
 */
export type DashboardChangesTable = { baseId: string; tableId: string };

export const DASHBOARD_CHANGES_TABLES = {
  bronson: { baseId: "appiMw8gpaLv2WITA", tableId: "tbl0tAPjjIBhUmydb" },
  aval: { baseId: "appgEcTIxQjmtRKbP", tableId: "tbls3zd3BvpygJ2Gm" },
  ecomSimulation: { baseId: "appgcEYqudlGfqBjE", tableId: "tblcP8CxZw6jb5Fn2" },
} satisfies Record<string, DashboardChangesTable>;

const WINDOW_DAYS = 14;

type ChangeRecord = { id: string; fields: { Date?: string; Changes?: string } };

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: the table is tiny and a note must show up right after it's saved.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

async function listRecords({ baseId, tableId }: DashboardChangesTable) {
  const records: ChangeRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{ records: ChangeRecord[]; offset?: string }>(
      `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${qs}`
    );
    records.push(...body.records);
    offset = body.offset;
  } while (offset);
  return records;
}

export type RecentChangeDay = { date: string; changesMadeToday: string };

/**
 * Last 14 days of notes, newest first. Days logged before this table existed
 * still come from the Marketing Daily Metrics "Changes Made Today" field;
 * when both exist for a day, the dashboard-written note wins.
 */
export async function getRecentChanges(
  table: DashboardChangesTable,
  legacyRows: { date: string | null; changesMadeToday: string | null }[]
): Promise<RecentChangeDay[]> {
  const cutoff = easternDateString(new Date(Date.now() - WINDOW_DAYS * 864e5));
  const today = easternDateString();
  const byDate = new Map<string, string>();

  for (const row of legacyRows) {
    const d = toEasternDateOnly(row.date);
    const text = row.changesMadeToday?.trim();
    if (d && text) byDate.set(d, text);
  }
  for (const r of await listRecords(table)) {
    const d = r.fields.Date?.slice(0, 10);
    const text = r.fields.Changes?.trim();
    if (d && text) byDate.set(d, text);
  }

  return [...byDate.entries()]
    .filter(([d]) => d >= cutoff && d <= today)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, changesMadeToday]) => ({ date, changesMadeToday }));
}

/** Upserts the note for one day; an empty note deletes that day's row. */
export async function saveDayChanges(table: DashboardChangesTable, date: string, changes: string) {
  const { baseId, tableId } = table;
  const existing = (await listRecords(table)).filter((r) => r.fields.Date?.slice(0, 10) === date);
  const text = changes.trim();
  const url = `${AIRTABLE_API_BASE}/${baseId}/${tableId}`;

  if (!text) {
    for (const r of existing) await airtable(`${url}/${r.id}`, { method: "DELETE" });
    return;
  }
  if (existing.length > 0) {
    await airtable(`${url}/${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { Changes: text } }),
    });
    return;
  }
  await airtable(url, {
    method: "POST",
    body: JSON.stringify({ fields: { Date: date, Changes: text }, typecast: true }),
  });
}
