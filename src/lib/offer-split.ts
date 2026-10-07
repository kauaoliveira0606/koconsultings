/**
 * Offer Split on the Overview tab: of everyone who bought on a high ticket
 * call, what share bought each offer.
 *
 * A purchase is a Post Call Note with Call Outcome = Deposit, Payment Plan or
 * Closed (PIF), dated inside the selected range. The offer is the note's
 * "Offer Pitched On/Closed" answer, and there is one row per option that
 * question has in Airtable. The same deal logged twice (same lead,
 * outcome and deal size) counts once.
 *
 * PIF rate rides along: of those same purchases, the share paid in full on
 * the call (Call Outcome = Closed (PIF)) rather than a payment plan or deposit.
 */
import type { NextRequest } from "next/server";
import { AirtableError, airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { emailKey, nameKey, text, type PaymentPlanOffer } from "@/lib/payment-plans";

// Same table ID in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

const OFFER_FIELD = "Offer Pitched On/Closed";

/** The form's "no offer" answer, which is not something anyone bought. */
const NO_OFFER = /^no pitch/i;

/**
 * The offers, exactly as the form lists them (names and order), read from
 * the field's own options in Airtable. Nothing here hardcodes an offer name,
 * so renaming one or adding a tier in Airtable just shows up.
 */
async function offerOptions(baseId: string): Promise<string[]> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${pat}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new AirtableError(`Airtable schema request failed (${res.status})`, res.status);
  const body = (await res.json()) as {
    tables: {
      id: string;
      fields: { name: string; options?: { choices?: { name: string }[] } }[];
    }[];
  };
  const field = body.tables
    .find((t) => t.id === POST_CALL_NOTE_TABLE_ID)
    ?.fields.find((f) => f.name === OFFER_FIELD);
  return (field?.options?.choices ?? []).map((c) => c.name).filter((n) => !NO_OFFER.test(n));
}

export type OfferSplitRow = {
  key: string;
  label: string;
  deals: number;
  /** Share of all purchases in the range, 0 to 1. Null when there are none. */
  share: number | null;
  cashCollected: number;
  dealValue: number;
};

export type OfferSplitResponse = {
  total: number;
  offers: OfferSplitRow[];
  paidInFull: number;
  paymentPlans: number;
  deposits: number;
  /** Paid in full ÷ total purchases, 0 to 1. Null when there are none. */
  pifRate: number | null;
};

export function offerSplitGet(offer: PaymentPlanOffer) {
  return async (request: NextRequest) => {
    const range = parseRangeFromRequest(request);
    const [records, options] = await Promise.all([
      airtableListAll<Record<string, unknown>>(offer.baseId, POST_CALL_NOTE_TABLE_ID, {
        filterByFormula:
          "OR({Call Outcome}='Payment Plan',{Call Outcome}='Deposit',{Call Outcome}='Closed (PIF)')",
      }),
      offerOptions(offer.baseId),
    ]);

    const empty = { deals: 0, share: null, cashCollected: 0, dealValue: 0 };
    const rows: OfferSplitRow[] = [
      ...options.map((name) => ({ key: name, label: name, ...empty })),
      // A purchase logged with no offer picked (or "No Pitch"): only shown when there is one.
      { key: "other", label: "No Offer Logged", ...empty },
    ];
    const outcomes = { "Closed (PIF)": 0, "Payment Plan": 0, Deposit: 0 };
    const seen = new Set<string>();
    const notes = records
      .map((r) => ({ id: r.id, f: r.fields, date: parseDateOnly(r.fields.Date) }))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    for (const { id, f, date } of notes) {
      const revenue = parseNumericText(f["Total Revenue"]);
      const lead = emailKey(f["Email (Lead)"]) ?? nameKey(text(f["Full Name (Lead)"])) ?? id;
      const dealKey = `${lead}|${f["Call Outcome"]}|${revenue ?? ""}`;
      if (seen.has(dealKey)) continue;
      seen.add(dealKey);
      if (!isDateInRange(date, range)) continue;
      const answer = text(f[OFFER_FIELD]);
      const row = rows.find((r) => r.key === answer) ?? rows[rows.length - 1];
      row.deals += 1;
      if (typeof f["Call Outcome"] === "string" && f["Call Outcome"] in outcomes) {
        outcomes[f["Call Outcome"] as keyof typeof outcomes] += 1;
      }
      row.cashCollected += parseNumericText(f["Cash Collected"]) ?? 0;
      row.dealValue += revenue ?? 0;
    }

    const total = rows.reduce((t, r) => t + r.deals, 0);
    for (const r of rows) r.share = total > 0 ? r.deals / total : null;
    return Response.json({
      total,
      offers: rows.filter((r) => r.key !== "other" || r.deals > 0),
      paidInFull: outcomes["Closed (PIF)"],
      paymentPlans: outcomes["Payment Plan"],
      deposits: outcomes.Deposit,
      pifRate: total > 0 ? outcomes["Closed (PIF)"] / total : null,
    } satisfies OfferSplitResponse);
  };
}
