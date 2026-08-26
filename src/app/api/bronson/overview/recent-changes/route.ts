import { getMarketingDailyMetrics } from "@/lib/airtable/tables";

export const revalidate = 60;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const marketing = await getMarketingDailyMetrics();
  const byDate = new Map(marketing.map((r) => [r.date, r]));

  const days = [0, 1, 2].map((offset) => {
    const date = isoDateDaysAgo(offset);
    const row = byDate.get(date);
    return {
      date,
      hasSubmission: !!row,
      changesMadeToday: row?.changesMadeToday ?? null,
      metrics: row
        ? {
            adSpend: row.adSpendMeta,
            costPerLead: row.costPerLeadMeta,
            optInsPaid: row.optInsPaid,
            optInsOrganic: row.optInsOrganic,
            landingPageConnectRate: row.landingPageConnectRate,
            vslViews: row.vslViews,
            vslPlayRate: row.vslPlayRate,
            vslEngagementRate: row.vslEngagementRate,
            emailOpenRate: row.confirmationEmailOpenRate,
            dials: row.dials,
            connectionRate: row.connectionRate,
            sales: row.salesLowTicket,
            cashCollected: row.cashCollectedLowTicket,
            closeRate: row.closeRateLowTicket,
            funnelConversionRate: row.funnelConversionRate,
          }
        : null,
    };
  });

  return Response.json({ days });
}
