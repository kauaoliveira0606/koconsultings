import { AirtableError, airtableListAll, airtableListFresh } from "@/lib/airtable/client";
import { AVAL_BASE_ID } from "@/lib/airtable/tables-aval";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/**
 * The reactivation engine (texts cold leads, books calls) writes these four
 * tables in the Aval base; the Reactivation section on /aval/overview reads
 * them. Everything is keyed by GHL Contact ID, no linked records.
 */
export const REACTIVATION_TABLES = {
  leads: "tbl7c04toFKqzWQck",
  messages: "tbltaFFLH2MBmKddt",
  aiCalls: "tblejqNTrv2m405xk",
  settings: "tblmRbeGvS9fs6J8h",
} as const;

export type ReactivationLead = {
  contactId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  firstTextedAt: string | null;
  bookedAt: string | null;
  optedOutAt: string | null;
  notNow: boolean;
};

export type ReactivationMessage = {
  id: string;
  contactId: string;
  leadName: string | null;
  direction: "out" | "in";
  body: string;
  touch: number | null;
  status: string;
  optOut: boolean;
  createdAt: string;
  sentAt: string | null;
};

export type ReactivationAiCall = {
  contactId: string | null;
  touch: number | null;
  model: string;
  costUsd: number;
  createdAt: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function getReactivationLeads(): Promise<ReactivationLead[]> {
  const records = await airtableListAll(AVAL_BASE_ID, REACTIVATION_TABLES.leads);
  return records.flatMap((r) => {
    const f = r.fields;
    const contactId = str(f["GHL Contact ID"]);
    if (!contactId) return [];
    return [
      {
        contactId,
        name: str(f.Name),
        email: str(f.Email),
        phone: str(f.Phone),
        firstTextedAt: str(f["First Texted At"]),
        bookedAt: str(f["Booked At"]),
        optedOutAt: str(f["Opted Out At"]),
        notNow: f.Status === "Not now",
      },
    ];
  });
}

function toMessage(id: string, f: Record<string, unknown>, createdTime: string): ReactivationMessage | null {
  const contactId = str(f["GHL Contact ID"]);
  if (!contactId) return null;
  return {
    id,
    contactId,
    leadName: str(f["Lead Name"]),
    direction: f.Direction === "in" ? "in" : "out",
    body: typeof f.Body === "string" ? f.Body : "",
    touch: num(f.Touch),
    status: str(f.Status) ?? "",
    optOut: f["Opt Out"] === true,
    createdAt: str(f["Created At"]) ?? createdTime,
    sentAt: str(f["Sent At"]),
  };
}

export async function getReactivationMessages(): Promise<ReactivationMessage[]> {
  const records = await airtableListAll(AVAL_BASE_ID, REACTIVATION_TABLES.messages);
  return records.flatMap((r) => toMessage(r.id, r.fields, r.createdTime) ?? []);
}

/** Drafts change from the dashboard's approve buttons, so read them uncached. */
export async function getReactivationDrafts(): Promise<ReactivationMessage[]> {
  const records = await airtableListFresh(AVAL_BASE_ID, REACTIVATION_TABLES.messages, {
    filterByFormula: "{Status}='draft'",
  });
  return records.flatMap((r) => toMessage(r.id, r.fields, r.createdTime) ?? []);
}

export async function getReactivationAiCalls(): Promise<ReactivationAiCall[]> {
  const records = await airtableListAll(AVAL_BASE_ID, REACTIVATION_TABLES.aiCalls);
  return records.map((r) => {
    const f = r.fields;
    return {
      contactId: str(f["GHL Contact ID"]),
      touch: num(f.Touch),
      model: str(f.Model) ?? "",
      costUsd: num(f["Cost USD"]) ?? 0,
      createdAt: str(f["Created At"]) ?? r.createdTime,
    };
  });
}

export type ReactivationSettings = { engineOn: boolean; dailyCap: number; offReason: string };

export async function getReactivationSettings(): Promise<ReactivationSettings> {
  const records = await airtableListFresh(AVAL_BASE_ID, REACTIVATION_TABLES.settings);
  const byKey = new Map(records.map((r) => [str(r.fields.Key), str(r.fields.Value) ?? ""]));
  return {
    engineOn: byKey.get("engine_on") === "1",
    dailyCap: Number(byKey.get("daily_cap")) || 20,
    offReason: byKey.get("off_reason") ?? "",
  };
}

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function patch(tableId: string, records: { id: string; fields: Record<string, unknown> }[]) {
  const res = await fetch(`${AIRTABLE_API_BASE}/${AVAL_BASE_ID}/${tableId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ records }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable update failed: ${await res.text()}`, res.status);
}

export async function setReactivationSetting(key: "engine_on" | "daily_cap" | "off_reason", value: string) {
  const records = await airtableListFresh(AVAL_BASE_ID, REACTIVATION_TABLES.settings, {
    filterByFormula: `{Key}='${key}'`,
  });
  if (records[0]) {
    await patch(REACTIVATION_TABLES.settings, [{ id: records[0].id, fields: { Value: value } }]);
    return;
  }
  const res = await fetch(`${AIRTABLE_API_BASE}/${AVAL_BASE_ID}/${REACTIVATION_TABLES.settings}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields: { Key: key, Value: value } }] }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable create failed: ${await res.text()}`, res.status);
}

/** Approve or reject a queued draft. Approved drafts are what the engine sends. */
export async function setDraftStatus(messageId: string, status: "approved" | "rejected") {
  await patch(REACTIVATION_TABLES.messages, [{ id: messageId, fields: { Status: status } }]);
}

/** The engine's own uncached reads, with record ids and raw fields. */
export async function getReactivationRows(table: keyof typeof REACTIVATION_TABLES, filterByFormula?: string) {
  return airtableListFresh(AVAL_BASE_ID, REACTIVATION_TABLES[table], filterByFormula ? { filterByFormula } : undefined);
}

export async function createReactivationRow(table: keyof typeof REACTIVATION_TABLES, fields: Record<string, unknown>) {
  const res = await fetch(`${AIRTABLE_API_BASE}/${AVAL_BASE_ID}/${REACTIVATION_TABLES[table]}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable create failed: ${await res.text()}`, res.status);
}

export async function updateReactivationRow(table: keyof typeof REACTIVATION_TABLES, id: string, fields: Record<string, unknown>) {
  await patch(REACTIVATION_TABLES[table], [{ id, fields }]);
}
