/**
 * Fees that come off high ticket cash before it is really ours:
 *
 *   - processing on every high ticket dollar collected (2.5% Bronson, 3% Aval)
 *   - a further 15% on anything financed (Clarity, Klarna, ...), so a financed
 *     deal loses 17.5% / 18% in total
 *
 * Low ticket is an affiliate payout, not a payment we process, so it carries
 * no fee here.
 *
 * High ticket cash on the Overview comes from the Marketing Daily Metrics
 * form, which doesn't say how a deal was paid. That only exists per deal, on
 * the Post Call Note and Follow Up Payment forms ("Where Was Payment
 * Collected On" starting with "Financed"), so the financed dollars are read
 * from there.
 */
import { airtableListAll } from "@/lib/airtable/client";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { isDateInRange, type ResolvedRange } from "@/lib/date-range";
import { emailKey, nameKey, text } from "@/lib/payment-plans";

import type { DealFeeRates } from "@/lib/deal-fee-rates";

// Same table IDs in every offer's base (the bases were cloned from one template).
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";

const isFinanced = (raw: unknown) => /^financed/i.test(text(raw) ?? "");

/** High ticket cash collected through a financing partner, inside the range. */
export async function getFinancedHighTicketCash(
  baseId: string,
  range: ResolvedRange
): Promise<number> {
  let financed = 0;
  for (const [date, cash] of await getFinancedHighTicketCashByDay(baseId)) {
    if (isDateInRange(date, range)) financed += cash;
  }
  return financed;
}

/** High ticket cash collected through a financing partner, per day, all time. */
export async function getFinancedHighTicketCashByDay(baseId: string): Promise<Map<string, number>> {
  const [notes, followUps] = await Promise.all([
    airtableListAll<Record<string, unknown>>(baseId, POST_CALL_NOTE_TABLE_ID),
    airtableListAll<Record<string, unknown>>(baseId, FOLLOW_UP_PAYMENT_TABLE_ID),
  ]);
  const byDay = new Map<string, number>();
  const add = (date: string | null, cash: number) => {
    if (date) byDay.set(date, (byDay.get(date) ?? 0) + cash);
  };
  // The same deal logged twice (same lead, outcome and deal size) counts once.
  const seen = new Set<string>();
  for (const { id, fields: f } of notes) {
    const cash = parseNumericText(f["Cash Collected"]);
    if (!cash || !isFinanced(f["Where Was Payment Collected On"])) continue;
    const lead = emailKey(f["Email (Lead)"]) ?? nameKey(text(f["Full Name (Lead)"])) ?? id;
    const key = `${lead}|${f["Call Outcome"]}|${parseNumericText(f["Total Revenue"]) ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add(parseDateOnly(f.Date), cash);
  }
  for (const { fields: f } of followUps) {
    const cash = parseNumericText(f["Cash Collected"]);
    if (!cash || !isFinanced(f["Where Was Payment Collected On"])) continue;
    add(parseDateOnly(f["Payment Collected Date"]), cash);
  }
  return byDay;
}

/**
 * Fees on a range's high ticket cash. `paidFees` is the share that falls on
 * paid-traffic cash: processing is exact, and financing is spread by paid's
 * share of high ticket cash, because a deal's traffic source isn't on the
 * post call note.
 */
export function dealFees(
  input: {
    cashHighTicket: number | null;
    cashHighTicketPaid: number | null;
    financedCash: number;
  },
  rates: DealFeeRates
) {
  const total = input.cashHighTicket ?? 0;
  const paid = input.cashHighTicketPaid ?? 0;
  // Never more financed cash than there is high ticket cash on the form.
  const financed = Math.min(input.financedCash, total);
  const processingFees = total * rates.processing;
  const financingFees = financed * rates.financing;
  const paidShare = total > 0 ? Math.min(1, paid / total) : 0;
  return {
    financedCash: financed,
    processingFees,
    financingFees,
    totalFees: processingFees + financingFees,
    paidFees: paid * rates.processing + financingFees * paidShare,
  };
}
