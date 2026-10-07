/**
 * Offer Split on the Overview tab: of everyone who bought on a high ticket
 * call, what share bought each offer.
 *
 * A purchase is a Post Call Note with Call Outcome = Deposit, Payment Plan or
 * Closed (PIF), dated inside the selected range. The offer is the note's
 * "Offer Pitched On/Closed" answer. The same deal logged twice (same lead,
 * outcome and deal size) counts once.
 *
 * PIF rate rides along: of those same purchases, the share paid in full on
 * the call (Call Outcome = Closed (PIF)) rather than a payment plan or deposit.
 */
import type { NextRequest } from "next/server";
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { emailKey, nameKey, text, type PaymentPlanOffer } from "@/lib/payment-plans";

// Same table ID in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

/**
 * Form answer -> the name the offer goes by on the dashboard. Order is how
 * they are shown. Matched by how the answer starts, not its full text: the
 * price in brackets and the top tier's name get reworded in Airtable
 * ("Mid tier ($3k-$4k)" / "Mid tier ($3k)", "Upsell/Premium" / "Mastermind").
 */
const OFFERS = [
  { key: "downsell", label: "$1K Downsell", match: /^downsell/i },
  { key: "mid", label: "$3K", match: /^mid/i },
  { key: "flagship", label: "$5K", match: /^flagship/i },
  { key: "upsell", label: "Upsell", match: /^(upsell|premium|mastermind)/i },
] as const;

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
    const records = await airtableListAll<Record<string, unknown>>(
      offer.baseId,
      POST_CALL_NOTE_TABLE_ID,
      {
        filterByFormula:
          "OR({Call Outcome}='Payment Plan',{Call Outcome}='Deposit',{Call Outcome}='Closed (PIF)')",
      }
    );

    const empty = { deals: 0, share: null, cashCollected: 0, dealValue: 0 };
    const rows: OfferSplitRow[] = [
      ...OFFERS.map((o) => ({
        key: o.key,
        label: o.key === "upsell" ? (offer.topOfferLabel ?? o.label) : o.label,
        ...empty,
      })),
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
      const answer = text(f["Offer Pitched On/Closed"]) ?? "";
      const index = OFFERS.findIndex((o) => o.match.test(answer));
      const row = rows[index === -1 ? rows.length - 1 : index];
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
