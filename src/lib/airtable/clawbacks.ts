import { AirtableError } from "@/lib/airtable/client";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/**
 * "Commission Clawbacks" table in each offer's base: clawbacks are handled by hand,
 * so they are typed in on the Commissions tab. Each row comes off that rep's
 * total in the pay period its Date falls in.
 */
export type ClawbacksTable = { baseId: string; tableId: string };

const tableUrl = ({ baseId, tableId }: ClawbacksTable) => `${AIRTABLE_API_BASE}/${baseId}/${tableId}`;

export type Clawback = {
  id: string;
  rep: string;
  date: string;
  amount: number;
  note: string;
};

type ClawbackRecord = {
  id: string;
  fields: { Rep?: string; Date?: string; Amount?: number; Note?: string };
};

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: the table is tiny and a clawback must show up right after it's saved.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export async function listClawbacks(table: ClawbacksTable): Promise<Clawback[]> {
  const clawbacks: Clawback[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{ records: ClawbackRecord[]; offset?: string }>(
      `${tableUrl(table)}?${qs}`
    );
    for (const r of body.records) {
      const rep = r.fields.Rep?.trim();
      const date = r.fields.Date?.slice(0, 10);
      const amount = r.fields.Amount;
      if (!rep || !date || typeof amount !== "number" || amount <= 0) continue;
      clawbacks.push({ id: r.id, rep, date, amount, note: r.fields.Note?.trim() ?? "" });
    }
    offset = body.offset;
  } while (offset);
  return clawbacks;
}

export async function addClawback(table: ClawbacksTable, input: Omit<Clawback, "id">) {
  await airtable(tableUrl(table), {
    method: "POST",
    body: JSON.stringify({
      fields: { Rep: input.rep, Date: input.date, Amount: input.amount, Note: input.note },
    }),
  });
}

export async function deleteClawback(table: ClawbacksTable, id: string) {
  await airtable(`${tableUrl(table)}/${id}`, { method: "DELETE" });
}
