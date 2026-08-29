import { airtableListAll } from "./client";
import { createAirtableTables, type TableIds } from "./tables";
import { parseDateOnly, parseNumericText } from "./parse";

export const AVAL_BASE_ID = "appgEcTIxQjmtRKbP"; // "Aval Trades" base

// Aval doesn't have dedicated Speed to Lead / Leaderboard tables yet, so
// those two getters from the shared factory are never called for Aval.
export const AVAL_TABLE_IDS: TableIds = {
  leads: "tblpFVOkddRGgm5rI",
  marketingDailyMetrics: "tblRdiOjEHQgth0TN",
  eodDialer: "tblWm3TRktDt075ih",
  eodCloser: "tbl0xIvtCZIjemZRZ",
  speedToLead: "",
  leaderboard: "",
};

export const {
  getLeads: getAvalLeads,
  getMarketingDailyMetrics: getAvalMarketingDailyMetrics,
  getEodDialer: getAvalEodDialer,
} = createAirtableTables(AVAL_BASE_ID, AVAL_TABLE_IDS);

const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";

export type AvalPostCallNoteRow = {
  id: string;
  date: string | null;
  repName: string | null;
  leadName: string | null;
  leadEmail: string | null;
  source: string | null;
  callOutcome: string | null;
  offerPitched: string | null;
  cashCollected: number | null;
  totalRevenue: number | null;
};

export async function getAvalPostCallNotes(): Promise<AvalPostCallNoteRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    POST_CALL_NOTE_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      repName: (f["Setters Full Name"] as string) ?? (f["Setters Name"] as string) ?? null,
      leadName: (f["Full Name (Lead)"] as string) ?? null,
      leadEmail: (f["Email (Lead)"] as string) ?? null,
      source: (f["Source of Lead (Where they came from)"] as string) ?? null,
      callOutcome: (f["Call Outcome"] as string) ?? null,
      offerPitched: (f["Offer Pitched On/Closed"] as string) ?? null,
      cashCollected: parseNumericText(f["Cash Collected"]),
      totalRevenue: parseNumericText(f["Total Revenue"]),
    };
  });
}

export type AvalEodCloserRow = {
  id: string;
  date: string | null;
  closerName: string | null;
  callsBooked: number | null;
  callsShowed: number | null;
  cancelledCalls: number | null;
  offersMade: number | null;
  dealsClosed: number | null;
  totalCashCollected: number | null;
  totalRevenue: number | null;
  outboundDials: number | null;
  totalTalkTimeRaw: string | null;
};

export async function getAvalEodCloser(): Promise<AvalEodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    EOD_CLOSER_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      closerName: (f["Closer Name"] as string) ?? (f.Name as string) ?? null,
      callsBooked: typeof f["Calls Booked"] === "number" ? (f["Calls Booked"] as number) : null,
      callsShowed: typeof f["Calls Showed"] === "number" ? (f["Calls Showed"] as number) : null,
      cancelledCalls:
        typeof f["Cancelled Calls"] === "number" ? (f["Cancelled Calls"] as number) : null,
      offersMade: typeof f["Offers Made"] === "number" ? (f["Offers Made"] as number) : null,
      dealsClosed: typeof f["Deals Closed"] === "number" ? (f["Deals Closed"] as number) : null,
      totalCashCollected:
        typeof f["Total Cash Collected"] === "number" ? (f["Total Cash Collected"] as number) : null,
      totalRevenue: typeof f["Total Revenue"] === "number" ? (f["Total Revenue"] as number) : null,
      outboundDials: parseNumericText(f["# of Outbound Dials"]),
      totalTalkTimeRaw: (f["Total Talk Time"] as string) ?? null,
    };
  });
}

export type AvalFollowUpPaymentRow = {
  id: string;
  date: string | null;
  setterName: string | null;
  closerName: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  cashCollected: number | null;
};

export async function getAvalFollowUpPayments(): Promise<AvalFollowUpPaymentRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    FOLLOW_UP_PAYMENT_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f["Payment Collected Date"]),
      setterName: (f["Setter Name"] as string) ?? null,
      closerName: (f["Closer Name"] as string) ?? null,
      leadFirstName: (f["Lead First Name"] as string) ?? null,
      leadLastName: (f["Lead Last Name"] as string) ?? null,
      cashCollected: parseNumericText(f["Cash Collected"]),
    };
  });
}
