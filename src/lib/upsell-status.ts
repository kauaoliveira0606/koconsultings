/**
 * Where each customer on the Upsell Potential tab stands on the upsell,
 * set by hand on the tab and stored in an "Upsell Status" table (one row per
 * customer, keyed by their email, or a record ID when there is none).
 */
import { AirtableError } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";
import type { PaymentPlanOffer } from "@/lib/payment-plans";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/** Nobody has a row until they are worked: no row means "Not Contacted". */
export const UPSELL_STATUSES = [
  "Not Contacted",
  // Tried, nobody answered: still needs another attempt.
  "No Pick Up",
  "Pitched",
  "Call Booked",
  "Upsold",
  "Not Interested",
  // Wants it, can't pay for it right now.
  "Financial DQ",
] as const;
export type UpsellStatus = (typeof UPSELL_STATUSES)[number];

export type UpsellStatusEntry = { status: UpsellStatus; note: string | null; updated: string | null };

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: a status set on the tab must show up right after it's saved.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

const tableUrl = (offer: PaymentPlanOffer) =>
  `${AIRTABLE_API_BASE}/${offer.baseId}/${offer.upsellStatusTableId}`;

export async function listUpsellStatuses(
  offer: PaymentPlanOffer
): Promise<Map<string, UpsellStatusEntry>> {
  const statuses = new Map<string, UpsellStatusEntry>();
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{
      records: { fields: Record<string, unknown> }[];
      offset?: string;
    }>(`${tableUrl(offer)}?${qs}`);
    for (const { fields: f } of body.records) {
      const key = typeof f["Customer Key"] === "string" ? f["Customer Key"].trim() : "";
      if (!key) continue;
      statuses.set(key, {
        status: UPSELL_STATUSES.find((s) => s === f.Status) ?? "Not Contacted",
        note: typeof f.Note === "string" && f.Note.trim() !== "" ? f.Note.trim() : null,
        updated: typeof f.Updated === "string" ? f.Updated.slice(0, 10) : null,
      });
    }
    offset = body.offset;
  } while (offset);
  return statuses;
}

/** Only what is passed changes: a new status leaves the note alone and the other way round. */
export async function saveUpsellStatus(
  offer: PaymentPlanOffer,
  input: { key: string; customer: string; status?: UpsellStatus; note?: string }
) {
  await airtable(tableUrl(offer), {
    method: "PATCH",
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: ["Customer Key"] },
      // Lets a status added here later create its own option in Airtable.
      typecast: true,
      records: [
        {
          fields: {
            "Customer Key": input.key,
            Customer: input.customer,
            Updated: easternDateString(),
            ...(input.status !== undefined ? { Status: input.status } : {}),
            ...(input.note !== undefined ? { Note: input.note } : {}),
          },
        },
      ],
    }),
  });
}

/** Route handler for a status / note edit from the Upsell Potential tab. */
export function upsellStatusPatch(offer: PaymentPlanOffer) {
  return async (request: Request) => {
    const body = (await request.json().catch(() => null)) as {
      key?: unknown;
      customer?: unknown;
      status?: unknown;
      note?: unknown;
    } | null;
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const customer = typeof body?.customer === "string" ? body.customer.trim() : "";
    const status = UPSELL_STATUSES.find((s) => s === body?.status);
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : undefined;
    if (
      !key ||
      key.length > 200 ||
      (body?.status !== undefined && !status) ||
      (status === undefined && note === undefined)
    ) {
      return Response.json(
        { error: `Expected { key, customer?, status?: ${UPSELL_STATUSES.join(" | ")}, note?: string }` },
        { status: 400 }
      );
    }
    await saveUpsellStatus(offer, { key, customer, status, note });
    return Response.json({ ok: true });
  };
}
