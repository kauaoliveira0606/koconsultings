import { SERVICE_TOKEN } from "@/lib/admin-gate";
import type { AdsDailyRow } from "@/lib/ads-cortana";

/**
 * Meta Ads insights through the Bronson site (www.ad-ventur.com/api/meta-insights),
 * which holds the Meta token. Gives ad set level, which Cortana can't.
 * Results from Meta are pixel events only (opt-ins, purchases); booked calls and
 * cash stay Cortana's at campaign and ad level.
 */
const ENDPOINT = "https://www.ad-ventur.com/api/meta-insights";

type MetaRow = {
  date: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  frequency: number | null;
  lpViews: number;
  video3s: number;
  thruplays: number;
  leads: number;
  registrations: number;
  purchases: number;
};

export type MetaResult =
  | { ok: true; rows: (AdsDailyRow & { parent: string | null })[] }
  | { ok: false; error: string };

export async function getMetaLevel(level: "campaign" | "adset" | "ad", since: string, until: string): Promise<MetaResult> {
  try {
    const res = await fetch(`${ENDPOINT}?level=${level}&since=${since}&until=${until}`, {
      headers: { "x-berlin-key": SERVICE_TOKEN },
      next: { revalidate: 300 },
    });
    const body = (await res.json().catch(() => ({}))) as {
      rows?: MetaRow[];
      entities?: Record<string, { status: string | null; dailyBudget: number | null }>;
      error?: string;
      detail?: { message?: string } | null;
    };
    if (!res.ok || !body.rows) {
      return { ok: false, error: body.detail?.message ? `${body.error}: ${body.detail.message}` : body.error ?? `HTTP ${res.status}` };
    }
    const ents = body.entities ?? {};
    return {
      ok: true,
      rows: body.rows.map((r) => {
        const id = (level === "campaign" ? r.campaignId : level === "adset" ? r.adsetId : r.adId) ?? "";
        const name = (level === "campaign" ? r.campaignName : level === "adset" ? r.adsetName : r.adName) ?? id;
        return {
          date: r.date,
          level,
          name,
          entityId: id,
          parent: level === "adset" ? r.campaignName : level === "ad" ? r.adsetName : null,
          status: ents[id]?.status ?? "",
          dailyBudget: ents[id]?.dailyBudget ?? null,
          spend: r.spend,
          impressions: r.impressions,
          reach: r.reach,
          clicks: r.clicks,
          linkClicks: r.linkClicks,
          uniqueLinkClicks: r.linkClicks,
          lpViews: r.lpViews,
          pageViews: 0,
          uniqueVisitors: 0,
          leads: r.leads,
          registrations: r.registrations || r.leads,
          booked: 0,
          callsHeld: 0,
          htSales: 0,
          sales: r.purchases,
          revenue: 0,
          htRevenue: 0,
          hookRate: null,
          holdRate: null,
          thruplays: r.thruplays,
          frequency: r.frequency,
          video3s: r.video3s,
          video3sImpressions: r.impressions,
        };
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Meta request failed" };
  }
}
