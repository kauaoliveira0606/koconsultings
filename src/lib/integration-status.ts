import { airtableListFresh } from "@/lib/airtable/client";

const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tbl4WaU3k30aROvbc";

export type IntegrationStatus = { connected: boolean; note: string; updatedAt: string | null };

function pat() {
  const p = process.env.AIRTABLE_PAT;
  if (!p) throw new Error("Missing AIRTABLE_PAT");
  return p;
}

/** Map of integration name -> status. */
export async function getStatuses(): Promise<Record<string, IntegrationStatus>> {
  const recs = await airtableListFresh(BASE, TABLE);
  const out: Record<string, IntegrationStatus> = {};
  for (const r of recs) {
    const f = r.fields as Record<string, unknown>;
    const name = String(f.Name ?? "");
    if (!name) continue;
    out[name] = {
      connected: f.Connected === true,
      note: String(f.Note ?? ""),
      updatedAt: f["Updated At"] ? String(f["Updated At"]) : null,
    };
  }
  return out;
}

/** Upsert a status row by Name. */
export async function setStatus(name: string, connected: boolean, note?: string) {
  const fields: Record<string, unknown> = { Name: name, Connected: connected, "Updated At": new Date().toISOString() };
  if (note !== undefined) fields.Note = note;
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${pat()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Name"] }, typecast: true, records: [{ fields }] }),
  });
  if (!res.ok) throw new Error(`Airtable upsert failed (${res.status}): ${await res.text()}`);
  return res.json();
}
