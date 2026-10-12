/**
 * Duplicate records marked as done on the Admin Team tab's Data Check panel.
 * Stored in a "Data Check Done" table, one row per duplicate, keyed by the
 * log plus the record IDs of its copies. Marking one done only takes it off
 * the dashboard's list: nothing in the log itself is changed or deleted.
 */
import { AirtableError } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: a duplicate marked done must leave the list right away.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

type DoneRow = { id: string; fields: Record<string, unknown> };

async function listDoneRows(baseId: string, tableId: string): Promise<DoneRow[]> {
  const rows: DoneRow[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{ records: DoneRow[]; offset?: string }>(
      `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${qs}`
    );
    rows.push(...body.records);
    offset = body.offset;
  } while (offset);
  return rows;
}

export async function listDoneDuplicateKeys(baseId: string, tableId: string): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const row of await listDoneRows(baseId, tableId)) {
    if (typeof row.fields.Key === "string" && row.fields.Key.trim() !== "") keys.add(row.fields.Key.trim());
  }
  return keys;
}

type DoneInput = { key?: unknown; source?: unknown; who?: unknown; date?: unknown };
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 500) : "");

/** POST marks a duplicate as done, DELETE puts it back on the list. */
export function dataCheckDoneHandlers(baseId: string, tableId: string) {
  const url = `${AIRTABLE_API_BASE}/${baseId}/${tableId}`;

  async function POST(request: Request) {
    const input = (await request.json().catch(() => ({}))) as DoneInput;
    const key = text(input.key);
    if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
    await airtable(url, {
      method: "PATCH",
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Key"] },
        records: [
          {
            fields: {
              Key: key,
              Source: text(input.source),
              Who: text(input.who),
              "Record Date": text(input.date),
              "Marked Done": easternDateString(),
            },
          },
        ],
      }),
    });
    return Response.json({ ok: true });
  }

  async function DELETE(request: Request) {
    const input = (await request.json().catch(() => ({}))) as DoneInput;
    const key = text(input.key);
    if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
    const rows = (await listDoneRows(baseId, tableId)).filter((r) => r.fields.Key === key);
    for (const row of rows) await airtable(`${url}/${row.id}`, { method: "DELETE" });
    return Response.json({ ok: true });
  }

  return { POST, DELETE };
}
