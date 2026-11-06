import { randomBytes } from "node:crypto";

/**
 * Wallet state in Airtable (Bronson base). Always read fresh: Apple's web
 * service calls must see a registration the moment it is written.
 */
const BASE = "appiMw8gpaLv2WITA";
export const WALLET_TABLES = {
  passes: "tblkm1JsJ8wFCaPkf",
  registrations: "tbl99DpSEPKpMSfmm",
  nudges: "tblKhUDOipUPcZBj9",
};

type Rec<F> = { id: string; fields: F };

async function at<T>(path: string, init?: RequestInit): Promise<T> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error("Missing AIRTABLE_PAT");
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const q = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function findAll<F>(table: string, formula: string): Promise<Rec<F>[]> {
  const out: Rec<F>[] = [];
  let offset = "";
  do {
    const params = new URLSearchParams({ filterByFormula: formula, pageSize: "100" });
    if (offset) params.set("offset", offset);
    const page = await at<{ records: Rec<F>[]; offset?: string }>(`${table}?${params}`);
    out.push(...page.records);
    offset = page.offset ?? "";
  } while (offset);
  return out;
}

export type PassFields = { Serial: string; "Auth Token": string; Event: string; Created?: string; Source?: string };
export type RegFields = {
  Key: string;
  "Device ID": string;
  "Push Token": string;
  Serial: string;
  Event: string;
  Active?: boolean;
  Updated?: string;
};

export async function createPass(eventId: string, source: string): Promise<PassFields> {
  const fields: PassFields = {
    Serial: randomBytes(12).toString("hex"),
    "Auth Token": randomBytes(24).toString("hex"),
    Event: eventId,
    Created: new Date().toISOString(),
    Source: source.slice(0, 200),
  };
  await at(WALLET_TABLES.passes, { method: "POST", body: JSON.stringify({ records: [{ fields }], typecast: true }) });
  return fields;
}

export async function getPass(serial: string): Promise<PassFields | null> {
  if (!/^[a-f0-9]{8,64}$/.test(serial)) return null;
  const recs = await findAll<PassFields>(WALLET_TABLES.passes, `{Serial}=${q(serial)}`);
  return recs[0]?.fields ?? null;
}

export async function upsertRegistration(f: Omit<RegFields, "Key" | "Updated" | "Active">, active: boolean) {
  const key = `${f["Device ID"]}|${f.Serial}`;
  const existing = await findAll<RegFields>(WALLET_TABLES.registrations, `{Key}=${q(key)}`);
  const fields = { ...f, Key: key, Active: active, Updated: new Date().toISOString() };
  if (existing[0]) {
    await at(WALLET_TABLES.registrations, {
      method: "PATCH",
      body: JSON.stringify({ records: [{ id: existing[0].id, fields }] }),
    });
    return { created: false, wasActive: !!existing[0].fields.Active };
  }
  await at(WALLET_TABLES.registrations, { method: "POST", body: JSON.stringify({ records: [{ fields }] }) });
  return { created: true, wasActive: false };
}

export async function deactivate(deviceId: string, serial: string) {
  const recs = await findAll<RegFields>(WALLET_TABLES.registrations, `{Key}=${q(`${deviceId}|${serial}`)}`);
  if (!recs[0]) return false;
  await at(WALLET_TABLES.registrations, {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: recs[0].id, fields: { Active: false, Updated: new Date().toISOString() } }] }),
  });
  return true;
}

export async function deactivateByToken(pushToken: string) {
  const recs = await findAll<RegFields>(WALLET_TABLES.registrations, `AND({Push Token}=${q(pushToken)},{Active})`);
  for (let i = 0; i < recs.length; i += 10) {
    await at(WALLET_TABLES.registrations, {
      method: "PATCH",
      body: JSON.stringify({ records: recs.slice(i, i + 10).map((r) => ({ id: r.id, fields: { Active: false } })) }),
    });
  }
}

export async function activeRegistrations(filter: { deviceId?: string; eventId?: string }) {
  const parts = ["{Active}"];
  if (filter.deviceId) parts.push(`{Device ID}=${q(filter.deviceId)}`);
  if (filter.eventId) parts.push(`{Event}=${q(filter.eventId)}`);
  return (await findAll<RegFields>(WALLET_TABLES.registrations, `AND(${parts.join(",")})`)).map((r) => r.fields);
}

export async function nudgeSent(key: string): Promise<boolean> {
  return (await findAll(WALLET_TABLES.nudges, `{Key}=${q(key)}`)).length > 0;
}

export async function recordNudge(f: { Key: string; Event: string; Occurrence: string; Kind: string; Devices: number }) {
  await at(WALLET_TABLES.nudges, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields: { ...f, "Sent At": new Date().toISOString() } }] }),
  });
}
