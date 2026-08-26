import { airtableListAll } from "./client";
import { parseDateOnly, parseNumericText } from "./parse";

const TABLE_IDS = {
  leads: "tbl4E1VNyL7ZbTi5C",
  marketingDailyMetrics: "tblOMLyTcuhDwUZbF",
  eodDialer: "tblWm3TRktDt075ih",
  eodCloser: "tbl0xIvtCZIjemZRZ",
  speedToLead: "tblxBgJe2hpDtzUdG",
  leaderboard: "tblumrfxY24tF2D8E",
} as const;

export type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string | null;
  cashCollected: number | null;
};

export async function getLeads(): Promise<LeadRow[]> {
  const records = await airtableListAll<{
    Name?: string;
    Email?: string;
    Phone?: string;
    Source?: string;
    "Created At"?: string;
    "Cash Collected"?: string;
  }>(TABLE_IDS.leads);

  return records.map((r) => ({
    id: r.id,
    name: r.fields.Name ?? null,
    email: r.fields.Email ?? null,
    phone: r.fields.Phone ?? null,
    source: r.fields.Source ?? null,
    createdAt: parseDateOnly(r.fields["Created At"]),
    cashCollected: parseNumericText(r.fields["Cash Collected"]),
  }));
}

export type MarketingDailyMetricRow = {
  id: string;
  date: string | null;
  dials: number | null;
  optInsPaid: number | null;
  optInsOrganic: number | null;
  salesLowTicket: number | null;
  cashCollectedLowTicket: number | null;
  adSpendMeta: number | null;
  changesMadeToday: string | null;
  costPerLeadMeta: number | null;
  landingPageConnectRate: number | null;
  optInRate: number | null;
  vslViews: number | null;
  vslPlayRate: number | null;
  vslEngagementRate: number | null;
  confirmationEmailOpenRate: number | null;
  connectionRate: number | null;
  closeRateLowTicket: number | null;
  funnelConversionRate: number | null;
  cashCollectedHighTicket: number | null;
  revenueHighTicket: number | null;
  callsBooked: number | null;
  callsShowed: number | null;
  highTicketDealsClosed: number | null;
};

export async function getMarketingDailyMetrics(): Promise<MarketingDailyMetricRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(
    TABLE_IDS.marketingDailyMetrics
  );

  return records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: parseDateOnly(f.Date),
      dials: parseNumericText(f.Dials),
      optInsPaid: parseNumericText(f["Opt ins (Paid)"]),
      optInsOrganic: parseNumericText(f["Opt ins (Organic)"]),
      salesLowTicket: parseNumericText(f["Sales - Low Ticket (Sales team)"]),
      cashCollectedLowTicket: parseNumericText(f["Cash Collected - Low ticket"]),
      adSpendMeta: parseNumericText(f["Ad Spend Meta"]),
      changesMadeToday: (f["Changes Made Today"] as string) ?? null,
      costPerLeadMeta: parseNumericText(f["Cost per Lead (Meta)"]),
      landingPageConnectRate: parseNumericText(f["Landing Page Connect Rate"]),
      optInRate: parseNumericText(f["Opt in rate (opt ins vs views)"]),
      vslViews: parseNumericText(f["VSL Views"]),
      vslPlayRate: parseNumericText(f["VSL Play Rate"]),
      vslEngagementRate: parseNumericText(f["VSL Engagement Rate"]),
      confirmationEmailOpenRate: parseNumericText(f["Confirmation Email open rate"]),
      connectionRate: parseNumericText(f["Connection rate (On total dials)"]),
      closeRateLowTicket: parseNumericText(f["Close rate - Low ticket"]),
      funnelConversionRate: parseNumericText(f["Funnel Conversion rate (Lt Sales/opt ins)"]),
      cashCollectedHighTicket: parseNumericText(f["Cash collected (High Ticket)"]),
      revenueHighTicket: parseNumericText(f["Revenue (High Ticket)"]),
      callsBooked: parseNumericText(f["Calls booked (On calendar)"]),
      callsShowed: parseNumericText(f["Calls Showed"]),
      highTicketDealsClosed: parseNumericText(f["High Ticket Deals Closed"]),
    };
  });
}

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

export async function getEodDialer(): Promise<EodDialerRow[]> {
  const records = await airtableListAll<Record<string, unknown>>(TABLE_IDS.eodDialer);

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

export type SpeedToLeadRow = {
  id: string;
  name: string | null;
  createdAt: string | null;
  firstCallAt: string | null;
  minutesToCall: number | null;
  status: string | null;
};

export async function getSpeedToLead(): Promise<SpeedToLeadRow[]> {
  const records = await airtableListAll<{
    Name?: string;
    "Created At"?: string;
    "First Call At"?: string;
    "Minutes to Call"?: number;
    Status?: string;
  }>(TABLE_IDS.speedToLead);

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

export type LeaderboardRow = {
  id: string;
  email: string | null;
  name: string | null;
  entries: number | null;
  lastUpdated: string | null;
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const records = await airtableListAll<{
    Email?: string;
    Name?: string;
    Entries?: number;
    "Last Updated"?: string;
  }>(TABLE_IDS.leaderboard);

  return records.map((r) => ({
    id: r.id,
    email: r.fields.Email ?? null,
    name: r.fields.Name ?? null,
    entries: typeof r.fields.Entries === "number" ? r.fields.Entries : null,
    lastUpdated: r.fields["Last Updated"] ?? null,
  }));
}
