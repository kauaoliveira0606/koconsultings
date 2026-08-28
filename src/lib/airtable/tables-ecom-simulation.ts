import { airtableListAll } from "./client";
import { createAirtableTables, type TableIds } from "./tables";
import { parseDateOnly, parseNumericText } from "./parse";

export const ECOM_SIMULATION_BASE_ID = "appgcEYqudlGfqBjE"; // "Andy - Ecom" base

export const ECOM_SIMULATION_TABLE_IDS: TableIds = {
  leads: "tblpFVOkddRGgm5rI",
  marketingDailyMetrics: "tblRdiOjEHQgth0TN",
  eodDialer: "tblWm3TRktDt075ih", // shared cross-offer rep log, same table as Bronson (no records for this offer)
  eodCloser: "tbl0xIvtCZIjemZRZ", // shared cross-offer rep log, same table as Bronson (no records for this offer)
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
