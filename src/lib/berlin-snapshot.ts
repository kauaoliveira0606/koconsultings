import { aggregateEntities, getAdsRange, type AdsEntity } from "@/lib/ads-cortana";
import { scoreCreatives } from "@/lib/creative-score";
import { getStoredAlerts } from "@/lib/ad-alerts";
import { ADMIN_COOKIE, SERVICE_TOKEN } from "@/lib/admin-gate";

/**
 * One snapshot of the live dashboard numbers, shared by Ask Berlin (Claude) and
 * Jeremy AI (sent inside its messages, since Jeremy AI's persona chat can't call
 * Berlin's tools itself).
 */
const slim = (list: AdsEntity[], n = 12) =>
  list.slice(0, n).map((e) => ({
    name: e.name,
    status: e.status,
    spent: Math.round(e.spend * 100) / 100,
    impressions: e.impressions,
    cpm: e.cpm && Math.round(e.cpm * 100) / 100,
    hookRate: e.hookRate && Math.round(e.hookRate * 1000) / 10,
    holdRate: e.holdRate && Math.round(e.holdRate * 1000) / 10,
    lctr: e.linkCtr && Math.round(e.linkCtr * 1000) / 10,
    lpViews: e.lpViews,
    lpConnect: e.lpConnectRate && Math.round(e.lpConnectRate * 1000) / 10,
    completeRegistrations: e.registrations,
    costPerRegistration: e.costPerOptIn && Math.round(e.costPerOptIn * 100) / 100,
    optInRate: e.optInRate && Math.round(e.optInRate * 1000) / 10,
    scheduled: e.booked,
    costPerSchedule: e.costPerBooked && Math.round(e.costPerBooked * 100) / 100,
    highTicket: e.htSales,
    highTicketRevenue: e.htRevenue,
    roas: e.roas && Math.round(e.roas * 100) / 100,
  }));

export async function snapshot(origin: string) {
  const presets = ["today", "yesterday", "last_7_days", "this_month"] as const;
  const ranges = await Promise.all(presets.map((p) => getAdsRange(p)));
  const ads: Record<string, unknown> = {};
  presets.forEach((p, i) => {
    const rows = ranges[i] ?? [];
    ads[p] = {
      campaigns: slim(aggregateEntities(rows.filter((r) => r.level === "campaign"))),
      adSets: slim(aggregateEntities(rows.filter((r) => r.level === "adset"))),
      ads: slim(aggregateEntities(rows.filter((r) => r.level === "ad"))),
    };
  });
  const last7 = ranges[2] ?? [];
  const creative = scoreCreatives(aggregateEntities(last7.filter((r) => r.level === "ad")))
    .filter((s) => s.verdict !== "Not enough spend")
    .map((s) => ({ ad: s.name, score: s.score, verdict: s.verdict, hook: s.pieces.hook.score, body: s.pieces.body.score, cta: s.pieces.cta.score, why: s.why }));
  const alerts = (await getStoredAlerts()).filter((a) => a.active).map((a) => ({ level: a.level, title: a.title, detail: a.detail }));
  const internal = (path: string) =>
    fetch(`${origin}${path}`, { headers: { cookie: `${ADMIN_COOKIE}=${SERVICE_TOKEN}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [pace, overview] = await Promise.all([internal("/api/bronson/ads/pace"), internal("/api/bronson/overview/metrics?preset=this_month")]);
  return { ads, creativeScoresLast7Days: creative, activeAlerts: alerts, pace, overviewThisMonth: overview };
}


/** Compact JSON for a chat message (top rows only, so it stays small). */
export async function snapshotText(origin: string): Promise<string> {
  const s = await snapshot(origin);
  return JSON.stringify(s);
}
