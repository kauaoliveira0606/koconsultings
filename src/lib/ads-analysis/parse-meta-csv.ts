import Papa from "papaparse";
import { safeDivide } from "../metrics";

export type RawMetaAdsRow = Record<string, string>;

export type AdPerformanceRow = {
  campaign: string;
  adSet: string;
  ad: string;
  spend: number;
  leads: number;
  sales: number;
  revenue: number;
  cpl: number | null;
  roas: number | null;
};

export type AdPerformanceSummary = {
  totalSpend: number;
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  avgCostPerLead: number | null;
  avgCostPerSale: number | null;
  averageRoas: number | null;
};

// Meta Ads Manager column names vary by "Customize columns" selection, so
// match tolerantly (case/space-insensitive) rather than positionally.
const COLUMN_ALIASES: Record<keyof Pick<AdPerformanceRow, "campaign" | "adSet" | "ad">, string[]> = {
  campaign: ["campaign name", "campaign"],
  adSet: ["ad set name", "ad set"],
  ad: ["ad name", "ad"],
};

const NUMERIC_ALIASES: Record<"spend" | "leads" | "sales" | "revenue", string[]> = {
  spend: ["amount spent (usd)", "amount spent", "spend"],
  leads: ["leads", "results"],
  sales: ["purchases", "sales", "website purchases"],
  revenue: ["purchases conversion value", "purchase value", "revenue"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function findValue(row: RawMetaAdsRow, aliases: string[]): string | undefined {
  const normalizedRow: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    normalizedRow[normalizeHeader(k)] = v;
  }
  for (const alias of aliases) {
    if (normalizedRow[alias] !== undefined) return normalizedRow[alias];
  }
  return undefined;
}

function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,%\s]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

export function parseMetaAdsCsv(fileText: string): RawMetaAdsRow[] {
  const result = Papa.parse<RawMetaAdsRow>(fileText, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

export function normalizeMetaAdsRows(rows: RawMetaAdsRow[]): AdPerformanceRow[] {
  return rows.map((row) => {
    const spend = toNumber(findValue(row, NUMERIC_ALIASES.spend));
    const leads = toNumber(findValue(row, NUMERIC_ALIASES.leads));
    const sales = toNumber(findValue(row, NUMERIC_ALIASES.sales));
    const revenue = toNumber(findValue(row, NUMERIC_ALIASES.revenue));

    return {
      campaign: findValue(row, COLUMN_ALIASES.campaign) ?? "Unknown Campaign",
      adSet: findValue(row, COLUMN_ALIASES.adSet) ?? "Unknown Ad Set",
      ad: findValue(row, COLUMN_ALIASES.ad) ?? "Unknown Ad",
      spend,
      leads,
      sales,
      revenue,
      cpl: safeDivide(spend, leads),
      roas: safeDivide(revenue, spend),
    };
  });
}

export function aggregateAdPerformance(rows: AdPerformanceRow[]): AdPerformanceSummary {
  const totalSpend = rows.reduce((a, r) => a + r.spend, 0);
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const totalSales = rows.reduce((a, r) => a + r.sales, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);

  return {
    totalSpend,
    totalLeads,
    totalSales,
    totalRevenue,
    avgCostPerLead: safeDivide(totalSpend, totalLeads),
    avgCostPerSale: safeDivide(totalSpend, totalSales),
    averageRoas: safeDivide(totalRevenue, totalSpend),
  };
}
