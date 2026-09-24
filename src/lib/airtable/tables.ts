import { airtableListAll } from "./client";
import { parseDateOnly, parseNumericText } from "./parse";
import { toEasternDateOnly } from "@/lib/date-range";

export type TableIds = {
  leads: string;
  marketingDailyMetrics: string;
  eodDialer: string;
  eodCloser: string;
  speedToLead: string;
  leaderboard: string;
  // "VSL Daily Stats": one row per Eastern day written hourly by the n8n VSL
  // Analytics Collector straight from VTurb (today included), so VSL numbers
  // never wait on the team's Marketing Daily Metrics form.
  vslDailyStats?: string;
};

export const BRONSON_BASE_ID = "appiMw8gpaLv2WITA";

export const BRONSON_TABLE_IDS: TableIds = {
  leads: "tbl4E1VNyL7ZbTi5C",
  marketingDailyMetrics: "tblOMLyTcuhDwUZbF",
  eodDialer: "tblWm3TRktDt075ih",
  eodCloser: "tbl0xIvtCZIjemZRZ",
  // "Speed to Lead (GHL)" — fed by the n8n "Bronson · Speed to Lead
  // (GHL → Airtable)" workflow off two GHL Power Dialer workflows.
  // Replaces the old ad-ventur.com-fed "Speed to Lead" table (tblxBgJe2hpDtzUdG).
  speedToLead: "tbluBr2D8A2yL20pf",
  leaderboard: "tblumrfxY24tF2D8E",
  vslDailyStats: "tblXkoLdiizJoUjjD",
};

export type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string | null;
  cashCollected: number | null;
};

export type MarketingDailyMetricRow = {
  id: string;
  date: string | null;
  dials: number | null;
  optInsPaid: number | null;
  optInsOrganic: number | null;
  salesLowTicket: number | null;
  cashCollectedLowTicket: number | null;
  // Paid / Organic splits the team added to the form 2026-09-03.
  // The cash fields are reconciled in the getter so Paid + Organic always
  // equals the Total (see splitCash) — nothing is left unattributed.
  salesLowTicketPaid: number | null;
  salesLowTicketOrganic: number | null;
  cashCollectedLowTicketPaid: number | null;
  cashCollectedLowTicketOrganic: number | null;
  cashCollectedHighTicketPaid: number | null;
  cashCollectedHighTicketOrganic: number | null;
  funnelConversionRatePaid: number | null;
  funnelConversionRateOrganic: number | null;
  adSpendMeta: number | null;
  changesMadeToday: string | null;
  costPerLeadMeta: number | null;
  landingPageConnectRate: number | null;
  optInRate: number | null;
  vslViews: number | null;
  vslPlayRate: number | null;
  vslEngagementRate: number | null;
  // VTurb unique plays; only on days covered by VSL Daily Stats.
  vslPlays: number | null;
  confirmationEmailOpenRate: number | null;
  connectionRate: number | null;
  closeRateLowTicket: number | null;
  funnelConversionRate: number | null;
  cashCollectedHighTicket: number | null;
  revenueHighTicket: number | null;
  callsBooked: number | null;
  callsShowed: number | null;
  highTicketDealsClosed: number | null;
  // Split of the same "deals closed" count, added 2026-09 alongside the
  // refund/chargeback fields below. No Organic counterpart field exists —
  // it's not needed since High Ticket Deals Closed (total) already covers it.
  highTicketDealsClosedPaid: number | null;
  // Added 2026-09 on every offer's Marketing Daily Metrics table so refund/
  // chargeback rate can finally be tracked instead of just noted as missing.
  refundCount: number | null;
  refundDollars: number | null;
  chargebackCount: number | null;
  chargebackDollars: number | null;
};

export type EodDialerRow = {
  id: string;
  name: string | null;
  setterName: string | null;
  date: string | null;
  outboundDials: number | null;
  pickups: number | null;
  callsBookedSet: number | null;
  callsShowed: number | null;
  convosOver2Min: number | null;
  totalTalkTimeRaw: string | null;
};

export type SpeedToLeadRow = {
  id: string;
  name: string | null;
  createdAt: string | null;
  firstCallAt: string | null;
  minutesToCall: number | null;
  status: string | null;
};

export type LeaderboardRow = {
  id: string;
  email: string | null;
  name: string | null;
  entries: number | null;
  lastUpdated: string | null;
};

/** a + b, where a blank side counts as 0 but both blank stays null (no data). */
function addNullable(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

type VslDay = {
  views: number | null;
  plays: number | null;
  playRate: number | null;
  engagementRate: number | null;
};

export type MarketingFormOptions = {
  /**
   * Aval / Ecom Simulation forms have no "(Organic)" columns: a plain column
   * (no "Paid" in its name) IS the organic figure and the "(Paid)" column is
   * logged on top, so Total = Paid + Organic. Applies to low-ticket sales and
   * cash, and to high-ticket cash when the base has no explicit (Organic)
   * column. Bronson has explicit Paid/Organic columns and keeps treating its
   * plain column as the combined total.
   */
  plainColumnsAreOrganic?: boolean;
};

export function createAirtableTables(
  baseId: string,
  tableIds: TableIds,
  formOptions: MarketingFormOptions = {}
) {
  async function getLeads(): Promise<LeadRow[]> {
    const records = await airtableListAll<{
      Name?: string;
      Email?: string;
      Phone?: string;
      Source?: string;
      "Created At"?: string;
      "Cash Collected"?: string;
    }>(baseId, tableIds.leads);

    return records.map((r) => ({
      id: r.id,
      name: r.fields.Name ?? null,
      email: r.fields.Email ?? null,
      phone: r.fields.Phone ?? null,
      source: r.fields.Source ?? null,
      // Aval stores a full UTC timestamp here (Bronson/Ecom a plain date);
      // bucket it by Eastern day like every other dashboard date, so an 8pm+
      // ET opt-in doesn't land on tomorrow.
      createdAt: toEasternDateOnly(r.fields["Created At"]),
      cashCollected: parseNumericText(r.fields["Cash Collected"]),
    }));
  }

  async function getVslDailyStats() {
    const byDate = new Map<string, VslDay>();
    if (!tableIds.vslDailyStats) return byDate;
    const records = await airtableListAll<Record<string, unknown>>(baseId, tableIds.vslDailyStats);
    for (const r of records) {
      const date = parseDateOnly(r.fields.Date);
      if (!date) continue;
      byDate.set(date, {
        views: parseNumericText(r.fields["VSL Views"]),
        plays: parseNumericText(r.fields["VSL Plays"]),
        playRate: parseNumericText(r.fields["VSL Play Rate"]),
        engagementRate: parseNumericText(r.fields["VSL Engagement Rate"]),
      });
    }
    return byDate;
  }

  /**
   * Marketing Daily Metrics rows, with VSL Views / Play Rate / Engagement Rate
   * taken from VTurb's "VSL Daily Stats" wherever it has that day. A VTurb day
   * with no form row yet (today, or before the team submits) gets its own row
   * with only the VSL fields filled, so those cards never sit empty.
   */
  async function getMarketingDailyMetrics(): Promise<MarketingDailyMetricRow[]> {
    const [formRecords, vslByDate] = await Promise.all([
      airtableListAll<Record<string, unknown>>(baseId, tableIds.marketingDailyMetrics),
      getVslDailyStats(),
    ]);
    const formDates = new Set(formRecords.map((r) => parseDateOnly(r.fields.Date)));
    const records = [
      ...formRecords,
      ...[...vslByDate.keys()]
        .filter((date) => !formDates.has(date))
        .map((date) => ({ id: `vsl-${date}`, fields: { Date: date } as Record<string, unknown> })),
    ];

    const overlaid = new Set<string>();
    return records.map(parseMarketingRecord).map((row) => {
      const vsl = row.date ? vslByDate.get(row.date) : undefined;
      if (!vsl || !row.date) return row;
      // Only one row per day carries the VTurb numbers, so a duplicated form
      // row can't double-count views.
      if (overlaid.has(row.date)) {
        return { ...row, vslViews: null, vslPlays: null, vslPlayRate: null, vslEngagementRate: null };
      }
      overlaid.add(row.date);
      return {
        ...row,
        vslViews: vsl.views,
        vslPlays: vsl.plays,
        vslPlayRate: vsl.playRate,
        vslEngagementRate: vsl.engagementRate,
      };
    });
  }

  function parseMarketingRecord(r: {
    id: string;
    fields: Record<string, unknown>;
  }): MarketingDailyMetricRow {
    const f = r.fields;
    const salesLTRaw = parseNumericText(
      f["Sales - Low Ticket (Sales team)"] ?? f["Sales - Low Ticket"]
    );
    // Each offer's base worded/cased this column differently: Bronson
    // "Low ticket sales (paid)", Aval "Sales - Low Ticket (Paid)", Ecom
    // Simulation "Low Ticket Sales (Paid)" — check all three so this
    // generic parser covers every offer's actual column.
    const salesLTPaid = parseNumericText(
      f["Low ticket sales (paid)"] ??
        f["Sales - Low Ticket (Paid)"] ??
        f["Low Ticket Sales (Paid)"]
    );
    const plainIsOrganic = formOptions.plainColumnsAreOrganic === true;
    const salesLTOrganicExplicit = plainIsOrganic
      ? salesLTRaw
      : parseNumericText(f["Low ticket sales (Organic)"] ?? f["Low ticket sales (organic)"]);
    const cashLTPlain = parseNumericText(f["Cash Collected - Low ticket"]);
    const cashLTRaw = plainIsOrganic ? null : cashLTPlain;
    // Same story: Bronson "Low ticket cash collected (Paid)", Aval "Cash
    // collected - Low ticket (Paid)", Ecom Simulation "Cash Low ticket
    // (Paid)".
    const cashLTPaid = parseNumericText(
      f["Low ticket cash collected (Paid)"] ??
        f["Cash collected - Low ticket (Paid)"] ??
        f["Cash Low ticket (Paid)"]
    );
    const cashLTOrganicExplicit = plainIsOrganic
      ? cashLTPlain
      : parseNumericText(f["Low ticket cash collected (Organic)"]);
    // Bronson "Cash collected (High Ticket)", Aval "High Ticket Cash
    // Collected", Ecom Simulation "High ticket cash collected".
    const cashHTRaw = parseNumericText(
      f["Cash collected (High Ticket)"] ??
        f["High Ticket Cash Collected"] ??
        f["High ticket cash collected"]
    );
    // Aval's field is spelled/named differently ("high Ticket Cash
    // (Paid)") than Bronson/Ecom Simulation's ("High ticket cash
    // collected (Paid)") — check both so this generic parser covers
    // every offer's actual column.
    const cashHTPaid = parseNumericText(
      f["High ticket cash collected (Paid)"] ?? f["high Ticket Cash (Paid)"]
    );
    const cashHTOrganicTyped = parseNumericText(f["High ticket cash collected (Organic)"]);
    const cashHTOrganicExplicit = plainIsOrganic
      ? cashHTOrganicTyped ?? cashHTRaw
      : cashHTOrganicTyped;
    // Bronson stopped filling in the combined Total column starting
    // 2026-09 and only types the Paid/Organic split; Aval/Ecom Simulation
    // type the Total and only occasionally split out Paid. So neither
    // side is authoritative on its own — cash must never fall out of the
    // Paid + Organic rows just because one column was left blank:
    //   Paid    = as typed (blank = $0 paid)
    //   Organic = the bigger of the typed Organic and (Total − Paid)
    //   Total   = Paid + Organic, so it can never sit below its own parts
    // Matches the Agency rollup (lib/agency.ts). A day with no cash figure
    // in any of the three columns stays null (no data), not $0.
    const splitCash = (
      total: number | null,
      paid: number | null,
      organicExplicit: number | null
    ) => {
      if (total === null && paid === null && organicExplicit === null) {
        return { total: null, paid: null, organic: null };
      }
      const p = paid ?? 0;
      const organic = Math.max(organicExplicit ?? 0, (total ?? 0) - p, 0);
      return { total: p + organic, paid: p, organic };
    };
    const cashLTSplit = splitCash(cashLTRaw, cashLTPaid, cashLTOrganicExplicit);
    const cashHTSplit = splitCash(plainIsOrganic ? null : cashHTRaw, cashHTPaid, cashHTOrganicExplicit);
    const cashLT = cashLTSplit.total;
    const cashHT = cashHTSplit.total;
    // Sales counts keep the older rule: Total is a floor, rebuilt from
    // Paid/Organic when blank; Organic is only inferred once Paid is typed.
    const minusPaid = (total: number | null, paid: number | null) =>
      total === null || paid === null ? null : Math.max(0, total - paid);
    const reconcileTotal = (
      raw: number | null,
      paid: number | null,
      organicExplicit: number | null
    ) => raw ?? (paid !== null || organicExplicit !== null ? (paid ?? 0) + (organicExplicit ?? 0) : null);
    const salesLT = reconcileTotal(
      plainIsOrganic ? null : salesLTRaw,
      salesLTPaid,
      salesLTOrganicExplicit
    );
    // Unlike the form's other percent fields (native Airtable percent
    // type, always a 0–1 fraction), "Conversion Rate (Paid)/(Organic)" is
    // free text and the team types whole percents into it ("25" meaning
    // 25%, not 2500%). A genuine fraction is never > 1, so this is a safe
    // one-way normalization regardless of which convention a given row
    // used.
    const asFraction = (v: number | null) => (v !== null && v > 1 ? v / 100 : v);
    const htClosedOrganic = parseNumericText(
      f["High Ticket Deals Closed"] ?? f["High ticket closes"]
    );
    const htClosedPaid = parseNumericText(
      f["High Ticket Deals Closed (Paid)"] ??
        f["High Ticket Closed (Paid)"] ??
        f["High ticket closes (Paid)"]
    );
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      dials: parseNumericText(f.Dials),
      optInsPaid: parseNumericText(f["Opt ins (Paid)"]),
      optInsOrganic: parseNumericText(f["Opt ins (Organic)"]),
      salesLowTicket: salesLT,
      cashCollectedLowTicket: cashLT,
      salesLowTicketPaid: salesLTPaid,
      salesLowTicketOrganic: salesLTOrganicExplicit ?? minusPaid(salesLT, salesLTPaid),
      cashCollectedLowTicketPaid: cashLTSplit.paid,
      cashCollectedLowTicketOrganic: cashLTSplit.organic,
      cashCollectedHighTicketPaid: cashHTSplit.paid,
      cashCollectedHighTicketOrganic: cashHTSplit.organic,
      funnelConversionRatePaid: asFraction(parseNumericText(f["Conversion Rate (Paid)"])),
      funnelConversionRateOrganic: asFraction(
        parseNumericText(f["Conversion Rate (Organic)"]) ??
          parseNumericText(f["Funnel Conversion rate Organic"])
      ),
      adSpendMeta: parseNumericText(f["Ad Spend Meta"]),
      changesMadeToday: (f["Changes Made Today"] as string) ?? null,
      costPerLeadMeta: parseNumericText(f["Cost per Lead (Meta)"]),
      landingPageConnectRate: parseNumericText(f["Landing Page Connect Rate"]),
      optInRate: parseNumericText(f["Opt in rate (opt ins vs views)"]),
      vslViews: parseNumericText(f["VSL Views"]),
      vslPlayRate: parseNumericText(f["VSL Play Rate"]),
      vslEngagementRate: parseNumericText(f["VSL Engagement Rate"]),
      vslPlays: null,
      confirmationEmailOpenRate: parseNumericText(f["Confirmation Email open rate"]),
      connectionRate: parseNumericText(
        f["Connection rate (On total dials)"] ?? f["Connection rate (Pick ups vs opt ins)"]
      ),
      closeRateLowTicket: parseNumericText(f["Close rate - Low ticket"]),
      funnelConversionRate: parseNumericText(f["Funnel Conversion rate (Lt Sales/opt ins)"]),
      cashCollectedHighTicket: cashHT,
      // Bronson "Revenue (High Ticket)", Aval "High TIcket Revenue" (sic —
      // that's the actual Airtable field name, typo and all), Ecom
      // Simulation "High ticket revenue".
      // Plain revenue column is organic; Aval also logs "High Ticket Revenue
      // (Paid)" on top of it, so the total is the two added together.
      revenueHighTicket: addNullable(
        parseNumericText(
          f["Revenue (High Ticket)"] ?? f["High TIcket Revenue"] ?? f["High ticket revenue"]
        ),
        parseNumericText(f["High Ticket Revenue (Paid)"])
      ),
      // Bronson / Aval / Ecom Simulation each named these differently.
      callsBooked: parseNumericText(
        f["Calls booked (On calendar)"] ??
          f["High Ticket Calls On The Calendar"] ??
          f["Calls on the calendar"]
      ),
      callsShowed: parseNumericText(
        f["Calls Showed"] ?? f["High Ticket Calls Shown"] ?? f["Calls shown"]
      ),
      // No form has an "(Organic)" closes column: the plain column is the
      // organic closes and "(Paid)" is logged on top, so total = both added.
      // Bronson calls the paid one "High Ticket Deals Closed (Paid)", Aval
      // "High Ticket Closed (Paid)", Ecom Simulation "High ticket closes (Paid)".
      highTicketDealsClosed: addNullable(htClosedOrganic, htClosedPaid),
      highTicketDealsClosedPaid: htClosedPaid,
      refundCount: parseNumericText(f["Refund count"]),
      refundDollars: parseNumericText(f["Refund dollars"]),
      chargebackCount: parseNumericText(f["Chargebacks"]),
      chargebackDollars: parseNumericText(f["Chargebacks dollars"]),
    };
  }

  async function getEodDialer(): Promise<EodDialerRow[]> {
    const records = await airtableListAll<Record<string, unknown>>(baseId, tableIds.eodDialer);

    return records.map((r) => {
      const f = r.fields;
      return {
        id: r.id,
        name: (f.Name as string) ?? null,
        setterName: (f["Setter Name"] as string) ?? null,
        date: parseDateOnly(f.Date),
        outboundDials: parseNumericText(f["# of Outbound Dials"]),
        pickups: parseNumericText(f["How many people picked up"]),
        callsBookedSet: parseNumericText(f["# Calls Booked/Set"]),
        callsShowed: parseNumericText(f["# Calls Showed"]),
        convosOver2Min: parseNumericText(f["How many convos did you have today (Over 2 mins)"]),
        totalTalkTimeRaw: (f["Total Talk Time"] as string) ?? null,
      };
    });
  }

  async function getSpeedToLead(): Promise<SpeedToLeadRow[]> {
    const records = await airtableListAll<{
      Name?: string;
      "Created At"?: string;
      "First Call At"?: string;
      "Minutes to Call"?: number;
      Status?: string;
    }>(baseId, tableIds.speedToLead);

    return records.map((r) => ({
      id: r.id,
      name: r.fields.Name ?? null,
      createdAt: r.fields["Created At"] ?? null,
      firstCallAt: r.fields["First Call At"] ?? null,
      minutesToCall:
        typeof r.fields["Minutes to Call"] === "number" ? r.fields["Minutes to Call"] : null,
      status: r.fields.Status ?? null,
    }));
  }

  async function getLeaderboard(): Promise<LeaderboardRow[]> {
    const records = await airtableListAll<{
      Email?: string;
      Name?: string;
      Entries?: number;
      "Last Updated"?: string;
    }>(baseId, tableIds.leaderboard);

    return records.map((r) => ({
      id: r.id,
      email: r.fields.Email ?? null,
      name: r.fields.Name ?? null,
      entries: typeof r.fields.Entries === "number" ? r.fields.Entries : null,
      lastUpdated: r.fields["Last Updated"] ?? null,
    }));
  }

  return { getLeads, getMarketingDailyMetrics, getEodDialer, getSpeedToLead, getLeaderboard };
}

export const {
  getLeads,
  getMarketingDailyMetrics,
  getEodDialer,
  getSpeedToLead,
  getLeaderboard,
} = createAirtableTables(BRONSON_BASE_ID, BRONSON_TABLE_IDS);

// Per-call closer log — richer than EOD Closer's daily aggregate (tracks the
// actual tier pitched and where the lead came from, per call), so this is
// the source of truth for pitch/close/lead-source breakdowns.
const POST_CALL_NOTE_TABLE_ID = "tbltiRXQvojxiTJaM";

const HIGH_TICKET_TIERS = ["Mid tier ($3k-$4k)", "Flagship ($5k)"];
const CLOSED_OUTCOMES = ["Closed (PIF)", "Payment Plan"];

export type PostCallNoteRow = {
  id: string;
  date: string | null;
  repName: string | null;
  leadName: string | null;
  source: string | null;
  callOutcome: string | null;
  offerPitched: string | null;
  cashCollected: number | null;
  totalRevenue: number | null;
};

export async function getPostCallNotes(): Promise<PostCallNoteRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    POST_CALL_NOTE_TABLE_ID
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      repName: (f["Setters Full Name"] as string) ?? (f["Setters Name"] as string) ?? null,
      leadName: (f["Full Name (Lead)"] as string) ?? null,
      source: (f["Source of Lead (Where they came from)"] as string) ?? null,
      callOutcome: (f["Call Outcome"] as string) ?? null,
      offerPitched: (f["Offer Pitched On/Closed"] as string) ?? null,
      cashCollected: parseNumericText(f["Cash Collected"]),
      totalRevenue: parseNumericText(f["Total Revenue"]),
    };
  });
}

// One row per lead per Eastern-time day with a 1+ minute phone conversation,
// written hourly by the n8n "Bronson · Connected Calls Collector (GHL →
// Airtable)" workflow. Source comes from the lead's GHL tag ("Base44 Paid" /
// "Base44 Organic"), which the two opt-in workflows apply on entry — so only
// leads who opted in after 2026-09-19 can appear here.
const CONNECTED_CALLS_TABLE_ID = "tblvKz06oPjczAk0p";

export type ConnectedCallRow = {
  id: string;
  date: string | null;
  contactId: string | null;
  source: string | null;
  callsOverOneMin: number | null;
};

export async function getConnectedCalls(): Promise<ConnectedCallRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    CONNECTED_CALLS_TABLE_ID
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

export function wasPitched(row: PostCallNoteRow): boolean {
  return !!row.offerPitched && row.offerPitched !== "No Pitch/No Show";
}

export function wasHighTicketPitched(row: PostCallNoteRow): boolean {
  return !!row.offerPitched && HIGH_TICKET_TIERS.includes(row.offerPitched);
}

export function wasClosed(row: PostCallNoteRow): boolean {
  return !!row.callOutcome && CLOSED_OUTCOMES.includes(row.callOutcome);
}

// EOD Dialer/EOD Closer/Post Call Note above are Bronson's legacy tracking —
// the team stopped submitting them mid-July 2026. Current activity (through
// today) lives in these two tables instead, same pattern as Ecom Simulation's
// Affiliate EOD/PCN, but with Bronson's own field names and — unlike Ecom
// Simulation — real high-ticket data, since Bronson actually has that motion.
const BRONSON_AFFILIATE_PCN_TABLE_ID = "tblXsKo89QNuRawBy";
const BRONSON_AFFILIATE_EOD_TABLE_ID = "tblezCVnizBHKPL4Q";

// Base44 + Wix affiliate-portal (team.aistorebuilder.com) payout data, one row
// per (Date, Brand), synced daily from the portal's Supabase backend by the
// n8n "Bronson · Base44/Wix Attribution Collector" workflow. This is the
// "what the affiliate network actually tracked and will pay us" side of the
// attribution rate; the Affiliate PCN table is the "what the team logged as
// closed" side. Brand is "base44" or "wix".
const BRONSON_AFFILIATE_PORTAL_DAILY_TABLE_ID = "tbl1Va2afCZAxj2SE";

export type BronsonAffiliateEodRow = {
  id: string;
  date: string | null;
  repName: string | null;
  outboundDials: number | null;
  pickups: number | null;
  softwarePitched: number | null;
  softwareClosed: number | null;
  highTicketCallsPitched: number | null;
  newHighTicketCallsBooked: number | null;
  highTicketCallsOnCalendar: number | null;
  highTicketCallsShowed: number | null;
  highTicketSetClosed: number | null;
  cashCollectedAffiliate: number | null;
  cashCollectedHighTicket: number | null;
  totalTalkTimeRaw: string | null;
};

export async function getBronsonAffiliateEod(): Promise<BronsonAffiliateEodRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    BRONSON_AFFILIATE_EOD_TABLE_ID
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
      highTicketCallsPitched: parseNumericText(f["high ticket call pitched"]),
      newHighTicketCallsBooked: parseNumericText(f["new high ticket calls booked"]),
      highTicketCallsOnCalendar: parseNumericText(f["calls on the calendar"]),
      highTicketCallsShowed: parseNumericText(f["calls showed"]),
      highTicketSetClosed: parseNumericText(f["set closed"]),
      cashCollectedAffiliate: parseNumericText(f["Cash collected affiliate"]),
      cashCollectedHighTicket: parseNumericText(f["cash collected high ticket"]),
      totalTalkTimeRaw: (f["total talk time"] as string) ?? null,
    };
  });
}

export type BronsonAffiliatePcnRow = {
  id: string;
  date: string | null;
  repName: string | null;
  leadName: string | null;
  leadEmail: string | null;
  software: string | null;
  plan: string | null;
  cpaCash: number | null;
};

export async function getBronsonAffiliatePcn(): Promise<BronsonAffiliatePcnRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    BRONSON_AFFILIATE_PCN_TABLE_ID
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
      cpaCash: parseNumericText(f["CPA (Payout / Cash Collected)"]),
    };
  });
}

// Bronson's high-ticket closer EOD. Sparse (only days with HT deal activity),
// but it's the real source for high-ticket cash / revenue by day.
const BRONSON_EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";

export type BronsonEodCloserRow = {
  id: string;
  date: string | null;
  dealsClosed: number | null;
  offersMade: number | null;
  callsBooked: number | null;
  callsShowed: number | null;
  cashCollectedHighTicket: number | null;
  revenueHighTicket: number | null;
};

export async function getBronsonEodCloser(): Promise<BronsonEodCloserRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    BRONSON_EOD_CLOSER_TABLE_ID
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

export type AffiliatePortalDailyRow = {
  id: string;
  date: string | null;
  brand: string | null;
  purchases: number | null;
  signups: number | null;
  commission: number | null;
};

export async function getAffiliatePortalDaily(): Promise<AffiliatePortalDailyRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    BRONSON_BASE_ID,
    BRONSON_AFFILIATE_PORTAL_DAILY_TABLE_ID
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
