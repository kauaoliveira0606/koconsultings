import { getMarketingDailyMetrics, getLeads, getAffiliateEod } from "@/lib/airtable/tables-ecom-simulation";
import { isPaidSource, isOrganicSource } from "@/lib/airtable/lead-source-lookup";
import { safeDivide, sum } from "@/lib/metrics";

// Not statically prerenderable: it always needs live Airtable data
// (and would otherwise be built before deploy env vars are available).
export const dynamic = "force-dynamic";
export const revalidate = 60;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const [marketing, leads, affiliateEod] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getAffiliateEod(),
  ]);
  const byDate = new Map(marketing.map((r) => [r.date, r]));

  const days = [0, 1, 2].map((offset) => {
    const date = isoDateDaysAgo(offset);
    const row = byDate.get(date);

    // Opt-ins, dials, connection rate and close rate come from the real
    // Leads/Affiliate EOD tables for this day, independent of whether the
    // Marketing Daily Metrics form was submitted.
    const dayLeads = leads.filter((l) => l.createdAt === date);
    const dayEod = affiliateEod.filter((r) => r.date === date);
    const optInsPaid = dayLeads.filter((l) => isPaidSource(l.source)).length;
    const optInsOrganic = dayLeads.filter((l) => isOrganicSource(l.source)).length;
    const dials = sum(dayEod.map((r) => r.outboundDials));
    const pickups = sum(dayEod.map((r) => r.pickups));
    const softwarePitched = sum(dayEod.map((r) => r.softwarePitched));
    const softwareClosed = sum(dayEod.map((r) => r.softwareClosed));

    return {
      date,
      hasSubmission: !!row,
      changesMadeToday: row?.changesMadeToday ?? null,
      metrics: {
        adSpend: row?.adSpendMeta ?? null,
        costPerLead: row?.costPerLeadMeta ?? null,
        optInsPaid: optInsPaid || null,
        optInsOrganic: optInsOrganic || null,
        landingPageConnectRate: row?.landingPageConnectRate ?? null,
        vslViews: row?.vslViews ?? null,
        vslPlayRate: row?.vslPlayRate ?? null,
        vslEngagementRate: row?.vslEngagementRate ?? null,
        dials,
        connectionRate: safeDivide(pickups, (optInsPaid + optInsOrganic) || null),
        sales: row?.salesLowTicket ?? null,
        cashCollected: row?.cashCollectedLowTicket ?? null,
        closeRate: safeDivide(softwareClosed, softwarePitched || null),
        funnelConversionRate: row?.funnelConversionRate ?? null,
      },
    };
  });

  return Response.json({ days });
}
