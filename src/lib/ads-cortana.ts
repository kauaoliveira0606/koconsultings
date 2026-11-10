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
  level: "campaign" | "ad";
  name: string;
  entityId: string;
  status: string;
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  lpViews: number;
  leads: number;
  registrations: number;
  booked: number;
  callsHeld: number;
  htSales: number;
  sales: number;
  revenue: number;
  hookRate: number | null;
  holdRate: number | null;
  thruplays: number;
  frequency: number | null;
  video3s: number;
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
      level: (f.Level === "ad" ? "ad" : "campaign") as "campaign" | "ad",
      name: String(f.Name ?? ""),
      entityId: String(f["Entity ID"] ?? ""),
      status: String(f.Status ?? ""),
      dailyBudget: nn(f["Daily Budget"]),
      spend: n(f.Spend),
      impressions: n(f.Impressions),
      reach: n(f.Reach),
      clicks: n(f.Clicks),
      linkClicks: n(f["Link Clicks"]),
      lpViews: n(f["LP Views"]),
      leads: n(f.Leads),
      registrations: n(f.Registrations),
      booked: n(f["Booked Calls"]),
      callsHeld: n(f["Calls Held"]),
      htSales: n(f["HT Sales"]),
      sales: n(f.Sales),
      revenue: n(f.Revenue),
      hookRate: nn(f["Hook Rate"]),
      holdRate: nn(f["Hold Rate"]),
      thruplays: n(f.Thruplays),
      frequency: nn(f.Frequency),
      video3s: n(f["Video 3s Views"]),
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

/** One campaign or ad summed over a date range, with the "webinar" column set computed. */
export type AdsEntity = {
  entityId: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  linkClicks: number;
  lpViews: number;
  registrations: number;
  booked: number;
  callsHeld: number;
  sales: number;
  revenue: number;
  cpm: number | null;
  linkCtr: number | null; // fraction
  hookRate: number | null; // fraction
  holdRate: number | null; // fraction
  lpConnectRate: number | null; // LP views ÷ link clicks
  optInRate: number | null; // registrations ÷ LP views
  costPerOptIn: number | null;
  costPerBooked: number | null;
  roas: number | null;
  frequency: number | null;
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
    const s = (k: keyof AdsDailyRow) => list.reduce((acc, r) => acc + (r[k] as number), 0);
    const spend = s("spend");
    const impressions = s("impressions");
    const video3s = s("video3s");
    const thruplays = s("thruplays");
    const reach = s("reach");
    // Hook = 3s views ÷ impressions; hold = thruplays ÷ 3s views (Cortana's definitions, rebuilt from sums).
    const hook = safeDivide(video3s, impressions);
    const hold = safeDivide(thruplays, video3s);
    out.push({
      entityId,
      name: latest.name,
      status: latest.status,
      dailyBudget: latest.dailyBudget,
      spend,
      impressions,
      linkClicks: s("linkClicks"),
      lpViews: s("lpViews"),
      registrations: s("registrations"),
      booked: s("booked"),
      callsHeld: s("callsHeld"),
      sales: s("sales"),
      revenue: s("revenue"),
      cpm: impressions ? (spend / impressions) * 1000 : null,
      linkCtr: safeDivide(s("linkClicks"), impressions),
      hookRate: video3s ? hook : null,
      holdRate: video3s ? hold : null,
      lpConnectRate: safeDivide(s("lpViews"), s("linkClicks")),
      optInRate: safeDivide(s("registrations"), s("lpViews")),
      costPerOptIn: spend ? safeDivide(spend, s("registrations")) : null,
      costPerBooked: spend ? safeDivide(spend, s("booked")) : null,
      roas: spend ? s("revenue") / spend : null,
      frequency: reach ? impressions / reach : null,
      spendShare: totalSpend ? spend / totalSpend : null,
      daily: list.map((r) => ({ date: r.date, spend: r.spend, registrations: r.registrations })),
    });
  }
  return out.sort((a, b) => b.spend - a.spend || b.registrations - a.registrations);
}
