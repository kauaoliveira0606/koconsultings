import { airtableListAll } from "./client";
import { createAirtableTables, type TableIds } from "./tables";
import { parseDateOnly, parseNumericText } from "./parse";

export const ECOM_SIMULATION_BASE_ID = "appgcEYqudlGfqBjE"; // "Andy - Ecom" base

export const ECOM_SIMULATION_TABLE_IDS: TableIds = {
  leads: "tblpFVOkddRGgm5rI",
  marketingDailyMetrics: "tblRdiOjEHQgth0TN",
  eodDialer: "tblWm3TRktDt075ih", // shared cross-offer rep log, same table as Bronson (no records for this offer)
  // Shared cross-offer table ID with Bronson, but THIS base's copy is its own
  // high-ticket closer's daily log (Jericho), active since 2026-09-13. See
  // getEodCloser() below.
  eodCloser: "tbl0xIvtCZIjemZRZ",
  speedToLead: "tblQc86rJh5uiAP0E", // created to mirror Bronson's Speed to Lead (no equivalent timing data exists for this offer)
  leaderboard: "tblqmFNXfaSuEI4n5", // created to mirror Bronson's Leaderboard
};

export const {
  getLeads,
  getMarketingDailyMetrics,
  getEodDialer,
  getSpeedToLead,
  getLeaderboard,
} = createAirtableTables(ECOM_SIMULATION_BASE_ID, ECOM_SIMULATION_TABLE_IDS);

// This offer's sales team runs an affiliate/CPA motion instead of Bronson's
// direct-dial motion, so its actual activity lives in these two tables rather
// than EOD Dialer/EOD Closer (which are empty for this base).
const AFFILIATE_PCN_TABLE_ID = "tblXsKo89QNuRawBy";
const AFFILIATE_EOD_TABLE_ID = "tblezCVnizBHKPL4Q";

export type AffiliateEodRow = {
  id: string;
  date: string | null;
  repName: string | null;
  outboundDials: number | null;
  pickups: number | null;
  softwarePitched: number | null;
  softwareClosed: number | null;
  cashCollectedLowTicket: number | null;
  cashCollectedHighTicket: number | null;
  totalTalkTimeRaw: string | null;
  yearlyPlans: number | null;
  monthlyPlans: number | null;
  // Setters' own high-ticket fields on this table — always 0 in practice
  // (the real high-ticket motion runs through EOD Closer/Post Call Note
  // instead, see below), but parsed anyway so nothing silently goes missing
  // if that ever changes, and so this row shape matches Bronson/Aval's for
  // the shared Weekly Scorecard builder.
  highTicketCallsPitched: number | null;
  newHighTicketCallsBooked: number | null;
  highTicketCallsOnCalendar: number | null;
  highTicketCallsShowed: number | null;
  highTicketSetClosed: number | null;
};

export async function getAffiliateEod(): Promise<AffiliateEodRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    ECOM_SIMULATION_BASE_ID,
    AFFILIATE_EOD_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      repName: (f["Your name"] as string) ?? null,
      outboundDials: parseNumericText(f["Outbound dials"]),
      pickups: parseNumericText(f["Pick ups"]),
      softwarePitched: parseNumericText(f["Software pitched"]),
      softwareClosed: parseNumericText(f["software closed"]),
      cashCollectedLowTicket: parseNumericText(f["Cash collected low ticket"]),
      cashCollectedHighTicket: parseNumericText(f["Cash collected high ticket"]),
      totalTalkTimeRaw: (f["total talk time"] as string) ?? null,
      yearlyPlans: parseNumericText(f["How many yearly plans"]),
      monthlyPlans: parseNumericText(f["How many monthly plans"]),
      highTicketCallsPitched: parseNumericText(f["high ticket call pitched"]),
      newHighTicketCallsBooked: parseNumericText(f["new high ticket calls booked"]),
      highTicketCallsOnCalendar: parseNumericText(f["calls on the calendar"]),
      highTicketCallsShowed: parseNumericText(f["calls showed"]),
      highTicketSetClosed: parseNumericText(f["set closed"]),
    };
  });
}

export type AffiliatePcnRow = {
  id: string;
  date: string | null;
  repName: string | null;
  leadName: string | null;
  leadEmail: string | null;
  software: string | null;
  plan: string | null;
  cpaCash: number | null;
};

export async function getAffiliatePcn(): Promise<AffiliatePcnRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    ECOM_SIMULATION_BASE_ID,
    AFFILIATE_PCN_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      repName: (f["Full Name"] as string) ?? null,
      leadName: (f["Lead name"] as string) ?? null,
      leadEmail: (f["lead email"] as string) ?? null,
      software: (f["Which software"] as string) ?? null,
      plan: (f["Plan?"] as string) ?? null,
      cpaCash: parseNumericText(f["Amount (CPA/Cash)"]),
    };
  });
}

// High-ticket closer's per-call log — Jericho started logging real closes here
// 2026-09-13. This offer's Affiliate EOD "high ticket call pitched"/"new high
// ticket calls booked" fields are always 0 (the setters' side of that motion
// never got used), so this table plus EOD Closer below are the actual source
// of truth for high-ticket pitch/close/cash.
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const HIGH_TICKET_CLOSED_OUTCOMES = ["Closed (PIF)", "Payment Plan"];

export type PostCallNoteRow = {
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
  fathomLink: string | null;
};

export async function getPostCallNotes(): Promise<PostCallNoteRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    ECOM_SIMULATION_BASE_ID,
    POST_CALL_NOTE_TABLE_ID
  );

  const rows = records.map((r) => {
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
      fathomLink: (f["Fathom Link"] as string) ?? null,
    };
  });

  // The closer has submitted this form twice for the same call at least once
  // (identical Fathom Link, e.g. Giovanni Hui / 2026-09-13) — dedupe on it so
  // a double-submission doesn't double-count cash or close counts everywhere
  // this feeds into. Rows without a link (nothing to dedupe against) all pass
  // through.
  const seenLinks = new Set<string>();
  return rows.filter((row) => {
    if (!row.fathomLink) return true;
    if (seenLinks.has(row.fathomLink)) return false;
    seenLinks.add(row.fathomLink);
    return true;
  });
}

export function wasPitched(row: PostCallNoteRow): boolean {
  return !!row.offerPitched && row.offerPitched !== "No Pitch/No Show";
}

export function wasClosed(row: PostCallNoteRow): boolean {
  return !!row.callOutcome && HIGH_TICKET_CLOSED_OUTCOMES.includes(row.callOutcome);
}

// Closer's daily aggregate — sparse (only days with HT activity).
const EOD_CLOSER_TABLE_ID = ECOM_SIMULATION_TABLE_IDS.eodCloser;

export type EodCloserRow = {
  id: string;
  date: string | null;
  closerName: string | null;
  callsBooked: number | null;
  callsShowed: number | null;
  offersMade: number | null;
  dealsClosed: number | null;
  cashCollectedHighTicket: number | null;
  revenueHighTicket: number | null;
};

export async function getEodCloser(): Promise<EodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    ECOM_SIMULATION_BASE_ID,
    EOD_CLOSER_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      closerName: (f["Closer Name"] as string) ?? null,
      callsBooked: parseNumericText(f["Calls Booked"]),
      callsShowed: parseNumericText(f["Calls Showed"]),
      offersMade: parseNumericText(f["Offers Made"]),
      dealsClosed: parseNumericText(f["Deals Closed"]),
      cashCollectedHighTicket: parseNumericText(f["Total Cash Collected"]),
      revenueHighTicket: parseNumericText(f["Total Revenue"]),
    };
  });
}
