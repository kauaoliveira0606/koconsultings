import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getMarketingDailyMetrics, getLeads, getAffiliateEod } from "@/lib/airtable/tables-ecom-simulation";
import { isPaidSource, isOrganicSource } from "@/lib/airtable/lead-source-lookup";
import { getGoals } from "@/lib/goals";
import { average, costPerLead, roas, safeDivide, sum } from "@/lib/metrics";
import { generateWeeklySummary, type ScorecardMetric } from "@/lib/weekly-summary-rules";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const [marketing, leads, affiliateEod, goals] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getAffiliateEod(),
    getGoals(),
  ]);
  const rows = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));

  const adSpendMeta = sum(rows.map((r) => r.adSpendMeta));
  const cashCollectedLowTicket = sum(rows.map((r) => r.cashCollectedLowTicket));
  const cashCollectedHighTicket = sum(rows.map((r) => r.cashCollectedHighTicket));
  const totalCashCollected =
    cashCollectedLowTicket !== null || cashCollectedHighTicket !== null
      ? (cashCollectedLowTicket ?? 0) + (cashCollectedHighTicket ?? 0)
      : null;
  // Opt-ins, dials, connection rate and close rate now come from the real
  // Leads/Affiliate EOD tables instead of the Marketing Daily Metrics form's
  // manually-typed fields.
  const optInsPaid = inRangeLeads.filter((l) => isPaidSource(l.source)).length || null;
  const optInsOrganic = inRangeLeads.filter((l) => isOrganicSource(l.source)).length || null;
  const vslViews = sum(rows.map((r) => r.vslViews));
  const dials = sum(inRangeEod.map((r) => r.outboundDials));
  const pickups = sum(inRangeEod.map((r) => r.pickups));
  const softwarePitched = sum(inRangeEod.map((r) => r.softwarePitched));
  const softwareClosed = sum(inRangeEod.map((r) => r.softwareClosed));
  const salesLowTicket = sum(rows.map((r) => r.salesLowTicket));
  const closeRateLowTicket = safeDivide(softwareClosed, softwarePitched || null);
  const landingPageConnectRate = average(rows.map((r) => r.landingPageConnectRate));
  const optInRate = average(rows.map((r) => r.optInRate));
  const vslPlayRate = average(rows.map((r) => r.vslPlayRate));
  const vslEngagementRate = average(rows.map((r) => r.vslEngagementRate));
  const connectionRate = safeDivide(pickups, (optInsPaid ?? 0) + (optInsOrganic ?? 0) || null);
  const funnelConversionRate = average(rows.map((r) => r.funnelConversionRate));
  const costPerLeadMeta = costPerLead(adSpendMeta, (optInsPaid ?? 0) + (optInsOrganic ?? 0) || null);
  const roasTotal = roas(totalCashCollected, adSpendMeta);

  const leadingMetrics = [
    { key: "adSpendMeta", label: "Ad Spend Meta", actual: adSpendMeta, goal: goals.adSpendMeta, higherIsBetter: false, format: "currency" as const },
    { key: "costPerLeadMeta", label: "Cost Per Lead (Meta)", actual: costPerLeadMeta, goal: goals.costPerLeadMeta?.max ?? null, higherIsBetter: false, format: "currency" as const },
    { key: "cashCollectedLowTicket", label: "Cash Collected - Low Ticket", actual: cashCollectedLowTicket, goal: goals.cashCollectedLowTicket, higherIsBetter: true, format: "currency" as const },
    { key: "funnelConversionRate", label: "Funnel Conversion Rate (LT Sales/Opt Ins)", actual: funnelConversionRate, goal: goals.funnelConversionRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
    { key: "roasTotal", label: "ROAS - Total", actual: roasTotal, goal: goals.roasTotal?.min ?? null, higherIsBetter: true, format: "ratio" as const },
    { key: "cpaLowTicket", label: "CPA - Low Ticket", actual: null, goal: goals.cpaLowTicket?.max ?? null, higherIsBetter: false, format: "currency" as const },
    { key: "totalCashCollected", label: "Total Cash Collected", actual: totalCashCollected, goal: goals.totalCashCollected, higherIsBetter: true, format: "currency" as const },
  ];

  const leadFlow = [
    { key: "optInsPaid", label: "Opt Ins (Paid)", actual: optInsPaid, goal: goals.optInsPaid, higherIsBetter: true, format: "number" as const },
    { key: "optInsOrganic", label: "Opt Ins (Organic)", actual: optInsOrganic, goal: goals.optInsOrganic, higherIsBetter: true, format: "number" as const },
    { key: "vslViews", label: "VSL Views", actual: vslViews, goal: goals.vslViews, higherIsBetter: true, format: "number" as const },
  ];

  const salesConversion = [
    { key: "dials", label: "Dials", actual: dials, goal: goals.dials, higherIsBetter: true, format: "number" as const },
    { key: "salesLowTicket", label: "Sales - Low Ticket", actual: salesLowTicket, goal: goals.salesLowTicket, higherIsBetter: true, format: "number" as const },
    { key: "closeRateLowTicket", label: "Close Rate - Low Ticket", actual: closeRateLowTicket, goal: goals.closeRateLowTicket?.min ?? null, higherIsBetter: true, format: "percent" as const },
  ];

  const marketingMetrics = [
    { key: "landingPageConnectRate", label: "Landing Page Connect Rate", actual: landingPageConnectRate, goal: goals.landingPageConnectRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
    { key: "optInRate", label: "Opt In Rate (Opt Ins vs Views)", actual: optInRate, goal: goals.optInRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
    { key: "vslPlayRate", label: "VSL Play Rate", actual: vslPlayRate, goal: goals.vslPlayRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
    { key: "vslEngagementRate", label: "VSL Engagement Rate", actual: vslEngagementRate, goal: goals.vslEngagementRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
  ];

  const backend = [
    { key: "connectionRate", label: "Connection Rate (Pickups vs Opt Ins)", actual: connectionRate, goal: goals.connectionRate?.min ?? null, higherIsBetter: true, format: "percent" as const },
  ];

  const allMetrics: ScorecardMetric[] = [
    ...leadingMetrics,
    ...leadFlow,
    ...salesConversion,
    ...marketingMetrics,
    ...backend,
  ].map((m) => ({ label: m.label, actual: m.actual, goal: m.goal, higherIsBetter: m.higherIsBetter }));

  return Response.json({
    leadingMetrics,
    leadFlow,
    salesConversion,
    marketingMetrics,
    backend,
    summary: generateWeeklySummary(allMetrics),
  });
}
