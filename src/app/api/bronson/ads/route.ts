import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, toEasternDateOnly } from "@/lib/date-range";
import { airtableListAll } from "@/lib/airtable/client";
import { BRONSON_BASE_ID, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { roas, costPerLead, sum } from "@/lib/metrics";
import { aggregateEntities, getAdsDaily } from "@/lib/ads-cortana";

export const revalidate = 60;

/** "Ads by Source (Cortana)" — daily per-source rows written by the Cortana sync. */
const ADS_TABLE = "tbl2nXoSrYezoMpaa";

type AdFields = {
  Date?: string;
  Source?: string;
  Class?: string;
  Revenue?: number;
  Leads?: number;
  Purchases?: number;
};

type SourceRow = {
  source: string;
  class: "Paid" | "Organic";
  revenue: number;
  leads: number;
  purchases: number;
};

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  // Cortana gives the per-source REVENUE/LEADS split. Ad SPEND comes from the
  // Marketing Daily Metrics form, which is the source of truth for spend
  // (Cortana's attributed spend over-counts). So spend/ROAS/CPL use the form.
  const [records, marketing, adsDaily] = await Promise.all([
    airtableListAll<AdFields>(BRONSON_BASE_ID, ADS_TABLE),
    getMarketingDailyMetrics(),
    getAdsDaily(),
  ]);

  // Campaign and ad level (Cortana): which campaign spends the most and what it gets back.
  const levelRows = adsDaily.filter((r) => isDateInRange(r.date, range));
  const campaigns = aggregateEntities(levelRows.filter((r) => r.level === "campaign"));
  const ads = aggregateEntities(levelRows.filter((r) => r.level === "ad"));
  // By day: each date's totals and its campaigns / ads, newest first.
  const dates = [...new Set(levelRows.map((r) => r.date))].sort().reverse();
  const byDay = dates.map((date) => {
    const dayCamp = levelRows.filter((r) => r.date === date && r.level === "campaign");
    const total = aggregateEntities(dayCamp.map((r) => ({ ...r, entityId: "total", name: "Total" })))[0] ?? null;
    return {
      date,
      total,
      campaigns: aggregateEntities(dayCamp),
      ads: aggregateEntities(levelRows.filter((r) => r.date === date && r.level === "ad")),
    };
  });
  const lastSpendDate = adsDaily.filter((r) => r.spend > 0).reduce((m, r) => (r.date > m ? r.date : m), "");

  const inRange = records
    .map((r) => r.fields)
    .filter((f) => isDateInRange((f.Date ?? "").slice(0, 10), range));

  // Form ad spend (Meta), per Eastern day and total in range.
  const inRangeMarketing = marketing.filter((r) => isDateInRange(toEasternDateOnly(r.date), range));
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta)) ?? 0;
  const spendByDate = new Map<string, number>();
  for (const r of inRangeMarketing) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    spendByDate.set(d, (spendByDate.get(d) ?? 0) + (r.adSpendMeta ?? 0));
  }

  const bySource = new Map<string, SourceRow>();
  for (const f of inRange) {
    const source = f.Source ?? "Unknown";
    const cls = f.Class === "Paid" ? "Paid" : "Organic";
    const row = bySource.get(source) ?? { source, class: cls, revenue: 0, leads: 0, purchases: 0 };
    row.revenue += Number(f.Revenue ?? 0);
    row.leads += Number(f.Leads ?? 0);
    row.purchases += Number(f.Purchases ?? 0);
    bySource.set(source, row);
  }

  const sources = [...bySource.values()].sort((a, b) => b.revenue - a.revenue);
  const paid = sources.filter((s) => s.class === "Paid");
  const paidRevenue = sum(paid.map((s) => s.revenue)) ?? 0;
  const totalRevenue = sum(sources.map((s) => s.revenue)) ?? 0;
  const paidLeads = sum(paid.map((s) => s.leads)) ?? 0;

  // Daily: spend from the form, revenue from Cortana.
  const revByDate = new Map<string, number>();
  for (const f of inRange) {
    const d = (f.Date ?? "").slice(0, 10);
    if (!d) continue;
    revByDate.set(d, (revByDate.get(d) ?? 0) + Number(f.Revenue ?? 0));
  }
  const allDates = new Set([...spendByDate.keys(), ...revByDate.keys()]);
  const daily = [...allDates]
    .sort()
    .map((date) => ({ date, spend: spendByDate.get(date) ?? 0, revenue: revByDate.get(date) ?? 0 }));

  return Response.json({
    totals: {
      adSpend,
      paidRevenue,
      organicRevenue: totalRevenue - paidRevenue,
      totalRevenue,
      paidRoas: roas(paidRevenue, adSpend),
      costPerLeadPaid: costPerLead(adSpend, paidLeads),
      leads: sum(sources.map((s) => s.leads)) ?? 0,
      paidLeads,
    },
    adSpendSource: "Marketing Daily Metrics form (Meta)",
    sources,
    daily,
    campaigns,
    ads,
    byDay,
    cortanaSpend: sum(campaigns.map((c) => c.spend)) ?? 0,
    lastSpendDate: lastSpendDate || null,
    hasData: inRange.length > 0 || adSpend > 0 || levelRows.length > 0,
  });
}
