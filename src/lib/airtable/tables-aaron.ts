import { airtableListAll, airtableListAllIncremental } from "./client";
import {
  createAirtableTables,
  type BronsonAffiliateEodRow,
  type BronsonEodCloserRow,
  CONNECTED_CALL_FIELDS,
  type ConnectedCallRow,
  type TableIds,
} from "./tables";
import { parseDateOnly, parseNumericText } from "./parse";

export const AARON_BASE_ID = "appuxfqSlDCFgNzn0"; // "Aaron" base (Remote Sales HQ)

// Aaron doesn't have a Leaderboard table, so that getter is never called for Aaron.
export const AARON_TABLE_IDS: TableIds = {
  leads: "tblerHUAulw1k5otC",
  marketingDailyMetrics: "tblRdiOjEHQgth0TN",
  eodDialer: "tblWm3TRktDt075ih",
  eodCloser: "tbl0xIvtCZIjemZRZ",
  // "Speed to Lead v2": n8n WHwpopWZPKOFzX1c, GHL opt-ins + first human call.
  speedToLead: "tblgbq8OfbhNhr8sn",
  leaderboard: "",
  vslDailyStats: "tbl5HOgO4cyZVXZWQ",
  // VSL.mp4 on setterhq.com/apply (VTurb player 6ad230e08bfab0b5d0c39b93).
  htVslDailyStats: "tblZprvCjoUD6Wql7",
  refunds: "tblUYpQ4mEeiFWSIQ",
};

export const {
  getLeads: getAaronLeads,
  getMarketingDailyMetrics: getAaronMarketingDailyMetrics,
  getEodDialer: getAaronEodDialer,
  getSpeedToLead: getAaronSpeedToLead,
} = createAirtableTables(AARON_BASE_ID, AARON_TABLE_IDS, {
  plainColumnsAreOrganic: true,
});

// One row per lead per Eastern-time day with a 1+ minute GHL phone call,
// written hourly by the n8n "Aaron · Connected Calls Collector (GHL →
// Airtable)" workflow (kpvIOAUdpMNL2myW). Source comes from the lead's GHL
// tag ("paid" / "organic"), applied by Zapier on opt-in.
const AARON_CONNECTED_CALLS_TABLE_ID = "tbl9glaXKhORUZKe9";

export async function getAaronConnectedCalls(): Promise<ConnectedCallRow[]> {
  // Big and upsert-only (never deleted): the partitioned read, like Leads.
  const records = await airtableListAllIncremental<Record<string, unknown>>(
    AARON_BASE_ID,
    AARON_CONNECTED_CALLS_TABLE_ID,
    CONNECTED_CALL_FIELDS
  );
  return records.map((r) => ({
    id: r.id,
    date: parseDateOnly(r.fields.Date),
    contactId: (r.fields["Contact ID"] as string) ?? null,
    source: (r.fields.Source as string) ?? null,
    callsOverOneMin:
      typeof r.fields["Calls Over 1 Min"] === "number" ? r.fields["Calls Over 1 Min"] : null,
  }));
}

const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";
const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";
const FOLLOW_UP_PAYMENT_TABLE_ID = "tblIv06rB4qG0msnZ";
const AARON_AFFILIATE_EOD_TABLE_ID = "tblMsNIo5ZbNECcSv";

// Per-setter daily EOD — same shape as Bronson's Affiliate EOD, different
// Airtable column spellings. Returns the Bronson row type so the shared
// weekly-scorecard builder consumes it directly.
export async function getAaronAffiliateEod(): Promise<BronsonAffiliateEodRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
    AARON_AFFILIATE_EOD_TABLE_ID
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
      selfBookedToReachOut: parseNumericText(f["Self-booked calls to reach out to"]),
      selfBookedConnected: parseNumericText(f["Self-booked leads connected"]),
    };
  });
}

// High-ticket closer EOD, Bronson row shape (Aaron's column names match).
export async function getAaronEodCloserScorecard(): Promise<BronsonEodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
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

export type AaronPostCallNoteRow = {
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
  /** When the note was filed: orders a same-day call against a reactivation text. */
  createdTime: string;
};

export async function getAaronPostCallNotes(): Promise<AaronPostCallNoteRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
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
      fathomLink: typeof f["Fathom Link"] === "string" ? f["Fathom Link"].trim() || null : null,
      createdTime: r.createdTime,
    };
  });
}

export type AaronEodCloserRow = {
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

export async function getAaronEodCloser(): Promise<AaronEodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
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

export type AaronFollowUpPaymentRow = {
  id: string;
  date: string | null;
  setterName: string | null;
  closerName: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  cashCollected: number | null;
};

export async function getAaronFollowUpPayments(): Promise<AaronFollowUpPaymentRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
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
// Aaron's sales team also runs the AI-store-builder affiliate/CPA motion
// (base44 only for this offer). "Affiliate PCN" is the team's own per-close
// log — the "true revenue" side of the attribution rate. "Affiliate Portal
// Daily" is synced daily from the affiliate portal's Supabase backend by the
// n8n "Aaron · Base44 Attribution Collector" workflow — the "what the network
// actually tracked" side. Both are keyed by calendar date.
const AARON_AFFILIATE_PCN_TABLE_ID = "tblFZy89IvQ6Dcsl0";
const AARON_AFFILIATE_PORTAL_DAILY_TABLE_ID = "tbls35QHcDzYJmrep";

export type AaronAffiliatePcnRow = {
  id: string;
  date: string | null;
  brand: string | null;
  plan: string | null;
  repName: string | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  cpaCash: number | null;
  /** When the note was filed: always after the close, used to order a same-day close against a text. */
  createdTime: string;
};

export async function getAaronAffiliatePcn(): Promise<AaronAffiliatePcnRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
    AARON_AFFILIATE_PCN_TABLE_ID
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
      leadPhone: (f["Phone number"] as string) ?? null,
      cpaCash: parseNumericText(f["CPA?"]),
      createdTime: r.createdTime,
    };
  });
}

export type AaronAffiliatePortalDailyRow = {
  id: string;
  date: string | null;
  brand: string | null;
  purchases: number | null;
  signups: number | null;
  commission: number | null;
};

export async function getAaronAffiliatePortalDaily(): Promise<AaronAffiliatePortalDailyRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    AARON_BASE_ID,
    AARON_AFFILIATE_PORTAL_DAILY_TABLE_ID
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
