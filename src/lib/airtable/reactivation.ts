import { AirtableError, airtableListAll, airtableListFresh } from "@/lib/airtable/client";
import { BRONSON_BASE_ID } from "@/lib/airtable/tables";
import { AVAL_BASE_ID } from "@/lib/airtable/tables-aval";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/** "...Masterclass" offers are the show-rate engines: replies to masterclass registrants, no cold texts. */
export type ReactivationOffer = "aval" | "bronson" | "bronsonMasterclass" | "avalMasterclass";

/**
 * The reactivation engine (texts cold leads, books calls) writes four tables
 * in each offer's base; the offer's Reactivation tab reads them. Everything
 * is keyed by GHL Contact ID, no linked records.
 */
const REACTIVATION_BASES: Record<
  ReactivationOffer,
  { baseId: string; tables: Record<"leads" | "messages" | "aiCalls" | "settings", string> }
> = {
  aval: {
    baseId: AVAL_BASE_ID,
    tables: { leads: "tbl7c04toFKqzWQck", messages: "tbltaFFLH2MBmKddt", aiCalls: "tblejqNTrv2m405xk", settings: "tblmRbeGvS9fs6J8h" },
  },
  // Created 2026-10-28 for the Base44 free course opt-in engine.
  bronson: {
    baseId: BRONSON_BASE_ID,
    tables: { leads: "tblZR0PubDIa63Zfm", messages: "tblAVON2uKp3n9Gb4", aiCalls: "tblf8q6sm6OLYFTRb", settings: "tbl6hx62lgWZxhKzr" },
  },
  // Created 2026-10-28 for the masterclass show-rate engine ("Show Rate ..." tables).
  bronsonMasterclass: {
    baseId: BRONSON_BASE_ID,
    tables: { leads: "tbl0lDXqb2TDAzteD", messages: "tblf95GScpqTQimQB", aiCalls: "tblLtwnCUqi1nZ1nf", settings: "tblrUSx0jAoEK34Wo" },
  },
  // Created 2026-10-29, same "Show Rate ..." tables as Bronson's.
  avalMasterclass: {
    baseId: AVAL_BASE_ID,
    tables: { leads: "tblTfRK0v7zZZwDk0", messages: "tbll28r7MUT134QyI", aiCalls: "tblJl3UAdtHdiJB0q", settings: "tblDkMNaYWSPowv0a" },
  },
};

type TableKey = "leads" | "messages" | "aiCalls" | "settings";
const base = (offer: ReactivationOffer) => REACTIVATION_BASES[offer].baseId;
const table = (offer: ReactivationOffer, key: TableKey) => REACTIVATION_BASES[offer].tables[key];

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

export async function getReactivationLeads(offer: ReactivationOffer): Promise<ReactivationLead[]> {
  const records = await airtableListAll(base(offer), table(offer, "leads"));
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

export async function getReactivationMessages(offer: ReactivationOffer): Promise<ReactivationMessage[]> {
  const records = await airtableListAll(base(offer), table(offer, "messages"));
  return records.flatMap((r) => toMessage(r.id, r.fields, r.createdTime) ?? []);
}

/** Drafts change from the dashboard's approve buttons, so read them uncached. */
export async function getReactivationDrafts(offer: ReactivationOffer): Promise<ReactivationMessage[]> {
  const records = await airtableListFresh(base(offer), table(offer, "messages"), {
    filterByFormula: "{Status}='draft'",
  });
  return records.flatMap((r) => toMessage(r.id, r.fields, r.createdTime) ?? []);
}

export async function getReactivationAiCalls(offer: ReactivationOffer): Promise<ReactivationAiCall[]> {
  const records = await airtableListAll(base(offer), table(offer, "aiCalls"));
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

export async function getReactivationSettings(offer: ReactivationOffer): Promise<ReactivationSettings> {
  const records = await airtableListFresh(base(offer), table(offer, "settings"));
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

async function patch(offer: ReactivationOffer, key: TableKey, records: { id: string; fields: Record<string, unknown> }[]) {
  const res = await fetch(`${AIRTABLE_API_BASE}/${base(offer)}/${table(offer, key)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ records }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable update failed: ${await res.text()}`, res.status);
}

export async function setReactivationSetting(offer: ReactivationOffer, key: "engine_on" | "daily_cap" | "off_reason" | "noshow_on", value: string) {
  const records = await airtableListFresh(base(offer), table(offer, "settings"), {
    filterByFormula: `{Key}='${key}'`,
  });
  if (records[0]) {
    await patch(offer, "settings", [{ id: records[0].id, fields: { Value: value } }]);
    return;
  }
  const res = await fetch(`${AIRTABLE_API_BASE}/${base(offer)}/${table(offer, "settings")}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields: { Key: key, Value: value } }] }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable create failed: ${await res.text()}`, res.status);
}

/** Approve or reject a queued draft. Approved drafts are what the engine sends. */
export async function setDraftStatus(offer: ReactivationOffer, messageId: string, status: "approved" | "rejected") {
  await patch(offer, "messages", [{ id: messageId, fields: { Status: status } }]);
}

/** Cached reads (60s) for dashboards, with record ids and raw fields. */
export async function listReactivationRows(offer: ReactivationOffer, key: TableKey) {
  return airtableListAll(base(offer), table(offer, key));
}

/** The engine's own uncached reads, with record ids and raw fields. */
export async function getReactivationRows(offer: ReactivationOffer, key: TableKey, filterByFormula?: string) {
  return airtableListFresh(base(offer), table(offer, key), filterByFormula ? { filterByFormula } : undefined);
}

export async function createReactivationRow(offer: ReactivationOffer, key: TableKey, fields: Record<string, unknown>) {
  const res = await fetch(`${AIRTABLE_API_BASE}/${base(offer)}/${table(offer, key)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
    cache: "no-store",
  });
  if (!res.ok) throw new AirtableError(`Airtable create failed: ${await res.text()}`, res.status);
}

export async function updateReactivationRow(offer: ReactivationOffer, key: TableKey, id: string, fields: Record<string, unknown>) {
  await patch(offer, key, [{ id, fields }]);
}
