import { airtableListAll } from "./client";
import {
  createAirtableTables,
  type BronsonAffiliateEodRow,
  type BronsonEodCloserRow,
  type TableIds,
} from "./tables";
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
const AVAL_AFFILIATE_EOD_TABLE_ID = "tblMsNIo5ZbNECcSv";

// Per-setter daily EOD — same shape as Bronson's Affiliate EOD, different
// Airtable column spellings. Returns the Bronson row type so the shared
// weekly-scorecard builder consumes it directly.
export async function getAvalAffiliateEod(): Promise<BronsonAffiliateEodRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    AVAL_AFFILIATE_EOD_TABLE_ID
  );
  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      repName: (f["Your Name"] as string) ?? (f.Name as string) ?? null,
      outboundDials: parseNumericText(f["Outbound dials"]),
      pickups: parseNumericText(f["Pick ups"]),
      softwarePitched: parseNumericText(f["Software pitched"]),
      softwareClosed: parseNumericText(f["Software closes"]),
      highTicketCallsPitched: parseNumericText(f["Pitched high ticket calls"]),
      newHighTicketCallsBooked: parseNumericText(f["New high ticket calls booked"]),
      highTicketCallsOnCalendar: parseNumericText(f["Calls on the calendar today"]),
      highTicketCallsShowed: parseNumericText(f["Calls showed"]),
      highTicketSetClosed: parseNumericText(f["High ticket set closes"]),
      cashCollectedAffiliate: parseNumericText(f["Cash collected Affiliate"]),
      cashCollectedHighTicket: parseNumericText(f["Cash collected High Ticket"]),
      totalTalkTimeRaw: (f["Total talk time"] as string) ?? null,
    };
  });
}

// High-ticket closer EOD, Bronson row shape (Aval's column names match).
export async function getAvalEodCloserScorecard(): Promise<BronsonEodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    EOD_CLOSER_TABLE_ID
  );
  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      dealsClosed: parseNumericText(f["Deals Closed"]),
      offersMade: parseNumericText(f["Offers Made"]),
      callsBooked: parseNumericText(f["Calls Booked"]),
      callsShowed: parseNumericText(f["Calls Showed"]),
      cashCollectedHighTicket: parseNumericText(f["Total Cash Collected"]),
      revenueHighTicket: parseNumericText(f["Total Revenue"]),
    };
  });
}

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

// --- Base44 affiliate attribution -------------------------------------------
// Aval's sales team also runs the AI-store-builder affiliate/CPA motion
// (base44 only for this offer). "Affiliate PCN" is the team's own per-close
// log — the "true revenue" side of the attribution rate. "Affiliate Portal
// Daily" is synced daily from the affiliate portal's Supabase backend by the
// n8n "Aval · Base44 Attribution Collector" workflow — the "what the network
// actually tracked" side. Both are keyed by calendar date.
const AVAL_AFFILIATE_PCN_TABLE_ID = "tblFZy89IvQ6Dcsl0";
const AVAL_AFFILIATE_PORTAL_DAILY_TABLE_ID = "tbls35QHcDzYJmrep";

export type AvalAffiliatePcnRow = {
  id: string;
  date: string | null;
  brand: string | null;
  plan: string | null;
  repName: string | null;
  leadName: string | null;
  leadEmail: string | null;
  cpaCash: number | null;
};

export async function getAvalAffiliatePcn(): Promise<AvalAffiliatePcnRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    AVAL_AFFILIATE_PCN_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      brand: (f["Which Software"] as string) ?? null,
      plan: (f["Plan?"] as string) ?? null,
      repName: (f["Your Name"] as string) ?? null,
      leadName: (f["Lead Name"] as string) ?? null,
      leadEmail: (f["Lead Email"] as string) ?? null,
      cpaCash: parseNumericText(f["CPA?"]),
    };
  });
}

export type AvalAffiliatePortalDailyRow = {
  id: string;
  date: string | null;
  brand: string | null;
  purchases: number | null;
  signups: number | null;
  commission: number | null;
};

export async function getAvalAffiliatePortalDaily(): Promise<AvalAffiliatePortalDailyRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AVAL_BASE_ID,
    AVAL_AFFILIATE_PORTAL_DAILY_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      brand: (f.Brand as string) ?? null,
      purchases: parseNumericText(f.Purchases),
      signups: parseNumericText(f.Signups),
      commission: parseNumericText(f.Commission),
    };
  });
}
