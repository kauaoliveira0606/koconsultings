import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { airtableListAll } from "@/lib/airtable/client";
import { BRONSON_BASE_ID } from "@/lib/airtable/tables";
import { roas, costPerLead, sum } from "@/lib/metrics";

export const revalidate = 60;

/** "Ads by Source (Cortana)" — daily per-source rows written by the Cortana sync. */
const ADS_TABLE = "tbl2nXoSrYezoMpaa";

type AdFields = {
  Date?: string;
  Source?: string;
  Class?: string;
  Spend?: number;
  Revenue?: number;
  Leads?: number;
  Purchases?: number;
};

type SourceRow = {
  source: string;
  class: "Paid" | "Organic";
  spend: number;
  revenue: number;
  leads: number;
  purchases: number;
  roas: number | null;
};

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const records = await airtableListAll<AdFields>(BRONSON_BASE_ID, ADS_TABLE);

  const inRange = records
    .map((r) => r.fields)
    .filter((f) => isDateInRange((f.Date ?? "").slice(0, 10), range));

  const bySource = new Map<string, SourceRow>();
  for (const f of inRange) {
    const source = f.Source ?? "Unknown";
    const cls = f.Class === "Paid" ? "Paid" : "Organic";
    const row =
      bySource.get(source) ?? { source, class: cls, spend: 0, revenue: 0, leads: 0, purchases: 0, roas: null };
    row.spend += Number(f.Spend ?? 0);
    row.revenue += Number(f.Revenue ?? 0);
    row.leads += Number(f.Leads ?? 0);
    row.purchases += Number(f.Purchases ?? 0);
    bySource.set(source, row);
  }

  const sources = [...bySource.values()]
    .map((r) => ({ ...r, roas: roas(r.revenue, r.spend) }))
    .sort((a, b) => b.revenue - a.revenue);

  const paid = sources.filter((s) => s.class === "Paid");
  const adSpend = sum(sources.map((s) => s.spend)) ?? 0;
  const paidRevenue = sum(paid.map((s) => s.revenue)) ?? 0;
  const totalRevenue = sum(sources.map((s) => s.revenue)) ?? 0;
  const paidLeads = sum(paid.map((s) => s.leads)) ?? 0;

  // Daily spend vs revenue, for the trend.
  const byDate = new Map<string, { date: string; spend: number; revenue: number }>();
  for (const f of inRange) {
    const d = (f.Date ?? "").slice(0, 10);
    if (!d) continue;
    const row = byDate.get(d) ?? { date: d, spend: 0, revenue: 0 };
    row.spend += Number(f.Spend ?? 0);
    row.revenue += Number(f.Revenue ?? 0);
    byDate.set(d, row);
  }
  const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

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
    sources,
    daily,
    hasData: inRange.length > 0,
  });
}
