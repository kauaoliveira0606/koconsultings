import { airtableListAll } from "@/lib/airtable/client";
import { BRONSON_BASE_ID } from "@/lib/airtable/tables";
import { safeDivide } from "@/lib/metrics";

/**
 * Bronson ads at campaign and ad level, from Cortana attribution.
 * n8n iXJRFVgLJ12gGZxd writes both tables every hour (today + yesterday,
 * and the last two finished hours). Cortana only has a day's spend the next
 * morning, so today's spend reads 0 until then.
 */
const DAILY_TABLE = "tblL8SDCb0PKcxdL7";
const HOURLY_TABLE = "tblDzlpmtwjR3v9kL";

export type AdsDailyRow = {
  date: string;
  level: "campaign" | "adset" | "ad";
  name: string;
  entityId: string;
  status: string;
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  uniqueLinkClicks: number;
  lpViews: number;
  pageViews: number;
  uniqueVisitors: number;
  leads: number;
  registrations: number;
  booked: number;
  callsHeld: number;
  htSales: number;
  sales: number;
  revenue: number;
  htRevenue: number;
  hookRate: number | null;
  holdRate: number | null;
  thruplays: number;
  frequency: number | null;
  video3s: number;
  video3sImpressions: number;
  /** Ad set rows: their campaign. Ad rows from Meta: their ad set. */
  parent?: string | null;
};

export type AdsHourlyRow = {
  hour: string; // Eastern, "YYYY-MM-DDTHH:00"
  campaign: string;
  entityId: string;
  leads: number;
  registrations: number;
  booked: number;
  sales: number;
  revenue: number;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const nn = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function getAdsDaily(): Promise<AdsDailyRow[]> {
  const recs = await airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, DAILY_TABLE);
  return recs
    .map(({ fields: f }) => ({
      date: String(f.Date ?? ""),
      level: (f.Level === "ad" ? "ad" : f.Level === "adset" ? "adset" : "campaign") as "campaign" | "adset" | "ad",
      name: String(f.Name ?? ""),
      entityId: String(f["Entity ID"] ?? ""),
      status: String(f.Status ?? ""),
      dailyBudget: nn(f["Daily Budget"]),
      spend: n(f.Spend),
      impressions: n(f.Impressions),
      reach: n(f.Reach),
      clicks: n(f.Clicks),
      linkClicks: n(f["Link Clicks"]),
      uniqueLinkClicks: n(f["Unique Link Clicks"]),
      lpViews: n(f["LP Views"]),
      pageViews: n(f["Page Views"]),
      uniqueVisitors: n(f["Unique Visitors"]),
      leads: n(f.Leads),
      registrations: n(f.Registrations),
      booked: n(f["Booked Calls"]),
      callsHeld: n(f["Calls Held"]),
      htSales: n(f["HT Sales"]),
      sales: n(f.Sales),
      revenue: n(f.Revenue),
      htRevenue: n(f["HT Revenue"]),
      hookRate: nn(f["Hook Rate"]),
      holdRate: nn(f["Hold Rate"]),
      thruplays: n(f.Thruplays),
      frequency: nn(f.Frequency),
      video3s: n(f["Video 3s Views"]),
      video3sImpressions: n(f["Video 3s Impressions"]),
    }))
    .filter((r) => r.date && r.entityId);
}

export async function getAdsHourly(): Promise<AdsHourlyRow[]> {
  const recs = await airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, HOURLY_TABLE);
  return recs
    .map(({ fields: f }) => ({
      hour: String(f.Hour ?? ""),
      campaign: String(f.Campaign ?? ""),
      entityId: String(f["Entity ID"] ?? ""),
      leads: n(f.Leads),
      registrations: n(f.Registrations),
      booked: n(f["Booked Calls"]),
      sales: n(f.Sales),
      revenue: n(f.Revenue),
    }))
    .filter((r) => r.hour);
}

/**
 * One campaign / ad set / ad summed over a date range, with the user's Cortana
 * "webinar" column set (screenshot 2026-11-10): Status, Budget, Spent, Reach,
 * Impressions, Hook rate, Hold rate, Frequency, CPM, Cost per link click,
 * Unique link clicks, LCTR, Landing page views, LP connect, Complete
 * registrations, Cost per complete registration, Opt-in rate, Schedule, Cost
 * per schedule, High ticket, High ticket revenue, ROAS.
 */
export type AdsEntity = {
  entityId: string;
  name: string;
  parent: string | null;
  status: string;
  dailyBudget: number | null;
  spend: number;
  reach: number;
  impressions: number;
  linkClicks: number;
  uniqueLinkClicks: number;
  lpViews: number;
  uniqueVisitors: number;
  /** Complete registrations (unique people). */
  registrations: number;
  /** Schedule = appointment_booked. */
  booked: number;
  callsHeld: number;
  sales: number;
  htSales: number;
  htRevenue: number;
  revenue: number;
  hookRate: number | null; // 3s views ÷ 3s-eligible impressions (Cortana's hook rate)
  holdRate: number | null; // Cortana's hold rate, weighted by 3s views
  frequency: number | null;
  cpm: number | null;
  costPerLinkClick: number | null;
  linkCtr: number | null; // LCTR: unique link clicks ÷ impressions
  lpConnectRate: number | null; // landing page views ÷ link clicks
  /** Opt-in rate: complete registrations ÷ landing page views. Blank when registrations outnumber page views (late-credited opt-ins). */
  optInRate: number | null;
  costPerOptIn: number | null; // cost per complete registration
  costPerBooked: number | null; // cost per schedule
  roas: number | null;
  spendShare: number | null;
  daily: { date: string; spend: number; registrations: number }[];
};

export function aggregateEntities(rows: AdsDailyRow[]): AdsEntity[] {
  const groups = new Map<string, AdsDailyRow[]>();
  for (const r of rows) {
    const list = groups.get(r.entityId) ?? [];
    list.push(r);
    groups.set(r.entityId, list);
  }
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const out: AdsEntity[] = [];
  for (const [entityId, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const latest = list[list.length - 1];
    const s = (k: keyof AdsDailyRow) => list.reduce((acc, r) => acc + ((r[k] as number) || 0), 0);
    const spend = s("spend");
    const impressions = s("impressions");
    const reach = s("reach");
    const video3s = s("video3s");
    const video3sImpressions = s("video3sImpressions");
    const uniqueLinkClicks = s("uniqueLinkClicks") || s("linkClicks");
    const lpViews = s("lpViews");
    const registrations = s("registrations");
    const holdWeighted = list.reduce((acc, r) => acc + (r.holdRate ?? 0) * r.video3s, 0);
    out.push({
      entityId,
      name: latest.name,
      parent: latest.parent ?? null,
      status: latest.status,
      dailyBudget: latest.dailyBudget,
      spend,
      reach,
      impressions,
      linkClicks: s("linkClicks"),
      uniqueLinkClicks,
      lpViews,
      uniqueVisitors: s("uniqueVisitors"),
      registrations,
      booked: s("booked"),
      callsHeld: s("callsHeld"),
      sales: s("sales"),
      htSales: s("htSales"),
      htRevenue: s("htRevenue"),
      revenue: s("revenue"),
      hookRate: video3sImpressions ? video3s / video3sImpressions : null,
      holdRate: video3s ? holdWeighted / video3s / 100 : null,
      frequency: reach ? impressions / reach : null,
      cpm: impressions ? (spend / impressions) * 1000 : null,
      costPerLinkClick: spend ? safeDivide(spend, s("linkClicks")) : null,
      linkCtr: safeDivide(uniqueLinkClicks, impressions),
      lpConnectRate: safeDivide(lpViews, s("linkClicks")),
      optInRate: lpViews && lpViews >= registrations ? registrations / lpViews : null,
      costPerOptIn: spend ? safeDivide(spend, registrations) : null,
      costPerBooked: spend ? safeDivide(spend, s("booked")) : null,
      roas: spend ? s("revenue") / spend : null,
      spendShare: totalSpend ? spend / totalSpend : null,
      daily: list.map((r) => ({ date: r.date, spend: r.spend, registrations: r.registrations })),
    });
  }
  return out.sort((a, b) => b.spend - a.spend || b.registrations - a.registrations);
}

/**
 * Cortana's own totals for a date preset (n8n wQGTB2H3g4t8bw3d, hourly), at
 * campaign / adset / ad level. Use these for range totals: Cortana dedupes
 * people across the whole range, and summing the daily rows double-counts
 * anyone who re-registers for a later webinar (Nov 4 campaign, this month:
 * 286 unique vs 541 summed). Only the latest run per preset counts.
 */
const RANGE_TABLE = "tblj3zPyKzSTxwSnV";
export const RANGE_PRESETS = ["today", "yesterday", "last_3_days", "last_7_days", "last_30_days", "this_month", "last_month", "all_time"];

export async function getAdsRange(preset: string): Promise<AdsDailyRow[] | null> {
  if (!RANGE_PRESETS.includes(preset)) return null;
  const recs = await airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, RANGE_TABLE);
  const mine = recs.map((r) => r.fields).filter((f) => f.Preset === preset);
  if (!mine.length) return null;
  const run = mine.reduce((m, f) => (String(f.Run ?? "") > m ? String(f.Run) : m), "");
  return mine
    .filter((f) => String(f.Run ?? "") === run)
    .map((f) => ({
      date: preset,
      level: (f.Level === "ad" ? "ad" : f.Level === "adset" ? "adset" : "campaign") as "campaign" | "adset" | "ad",
      name: String(f.Name ?? ""),
      entityId: String(f["Entity ID"] ?? ""),
      status: String(f.Status ?? ""),
      dailyBudget: nn(f["Daily Budget"]),
      spend: n(f.Spend),
      impressions: n(f.Impressions),
      reach: n(f.Reach),
      clicks: 0,
      linkClicks: n(f["Link Clicks"]),
      uniqueLinkClicks: n(f["Unique Link Clicks"]),
      lpViews: n(f["LP Views"]),
      pageViews: n(f["Page Views"]),
      uniqueVisitors: n(f["Unique Visitors"]),
      leads: n(f.Leads),
      registrations: n(f.Registrations),
      booked: n(f["Booked Calls"]),
      callsHeld: n(f["Calls Held"]),
      htSales: n(f["HT Sales"]),
      sales: n(f.Sales),
      revenue: n(f.Revenue),
      htRevenue: n(f["HT Revenue"]),
      hookRate: nn(f["Hook Rate"]),
      holdRate: nn(f["Hold Rate"]),
      thruplays: n(f.Thruplays),
      frequency: nn(f.Frequency),
      video3s: n(f["Video 3s Views"]),
      video3sImpressions: n(f["Video 3s Impressions"]),
    }))
    .filter((r) => r.entityId);
}
