import { sheetsGetRows } from "./client";
import { parseNumericText, parseUsDateToIso } from "./parse";

// "Rippy Sales Team EOD" — daily setter self-report. Brand new as of
// 2026-08-29, so it starts empty; populates as setters submit it.
const RIPPY_SETTER_EOD_SPREADSHEET_ID = "1cge3v_20S8u6niivPLRVfM5ZclSAQ3yLPwIddF83yCE";
const RIPPY_SETTER_EOD_SHEET_NAME = "Setter EOD";

// "Rippy EOC Report (Responses)" — per-call closer form, live since March
// 2025. Ground truth for high-ticket outcomes and cash collected.
const RIPPY_EOC_SPREADSHEET_ID = "1GsNJlKAiY2YJqfzBASZ-7RGRr6A7CAzh72fAga2SQc4";
const RIPPY_EOC_SHEET_NAME = "Form Responses 1";

// "Rippy Base44 Closes" — per-close low-ticket record with proof of
// purchase, actively used as of 2026-08-29.
const RIPPY_BASE44_SPREADSHEET_ID = "1_pQ2_06hYo8AObB2r7IKzH6x2__jQoQybs98yFo6RiM";
const RIPPY_BASE44_SHEET_NAME = "Rippy Base44 Closes";

export type RippySetterEodRow = {
  date: string | null;
  name: string | null;
  outboundDials: number | null;
  pickups: number | null;
  base44Pitched: number | null;
  base44Closed: number | null;
  highTicketCallsBooked: number | null;
  highTicketCallsShowed: number | null;
};

export async function getRippySetterEod(): Promise<RippySetterEodRow[]> {
  const rows = await sheetsGetRows(RIPPY_SETTER_EOD_SPREADSHEET_ID, RIPPY_SETTER_EOD_SHEET_NAME);
  return rows.map((r) => ({
    date: parseUsDateToIso(r["Date"]),
    name: r["Name"] || null,
    outboundDials: parseNumericText(r["Outbound Dials"]),
    pickups: parseNumericText(r["Pick Ups"]),
    base44Pitched: parseNumericText(r["Base44 Pitched"]),
    base44Closed: parseNumericText(r["Base44 Closed"]),
    highTicketCallsBooked: parseNumericText(r["HT Calls Booked"]),
    highTicketCallsShowed: parseNumericText(r["HT Calls Showed"]),
  }));
}

export type RippyEocRow = {
  date: string | null;
  closerName: string | null;
  setterName: string | null;
  callOutcome: string | null;
  offerMade: string | null;
  cashCollected: number | null;
  revenueGenerated: number | null;
  prospectEmail: string | null;
};

export async function getRippyEoc(): Promise<RippyEocRow[]> {
  const rows = await sheetsGetRows(RIPPY_EOC_SPREADSHEET_ID, RIPPY_EOC_SHEET_NAME);
  return rows.map((r) => ({
    date: parseUsDateToIso(r["Date Call Was Taken"]),
    closerName: r["Closer Name"] || null,
    setterName: r["Setter Name"] || null,
    callOutcome: r["Call Outcome"] || null,
    offerMade: r["Offer Made"] || null,
    cashCollected: parseNumericText(r["Cash Collected"]),
    revenueGenerated: parseNumericText(r["Revenue Generated"]),
    prospectEmail: r["Prospect Email"] || null,
  }));
}

/**
 * "Call Outcome" is free-ish text with many variants (Closed, Closed
 * (Payment Plan), Closed (PIF), Closed ($497), Follow Up Payment, Deposit
 * Collected, No Show, DQ ..., etc). A new high-ticket close is any outcome
 * that starts with "Closed" — "Follow Up Payment" is a later installment on
 * an already-counted close, so it's excluded from the close count but its
 * Cash Collected still rolls into the cash-collected total.
 */
export function isHighTicketClose(outcome: string | null): boolean {
  return !!outcome && outcome.trim().toLowerCase().startsWith("closed");
}

export type RippyBase44CloseRow = {
  dateClosed: string | null;
  closerName: string | null;
  cashCollected: number | null;
  prospectEmail: string | null;
};

export async function getRippyBase44Closes(): Promise<RippyBase44CloseRow[]> {
  const rows = await sheetsGetRows(RIPPY_BASE44_SPREADSHEET_ID, RIPPY_BASE44_SHEET_NAME);
  return rows.map((r) => ({
    dateClosed: parseUsDateToIso(r["Date Closed"]),
    closerName: r["Closer Name"] || null,
    cashCollected: parseNumericText(r["Cash Collected"]),
    prospectEmail: r["Prospect Email"] || null,
  }));
}
