import { getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";

// Always needs live Airtable data.
export const dynamic = "force-dynamic";
export const revalidate = 60;

const WINDOW_DAYS = 14;

export async function GET() {
  const marketing = await getAvalMarketingDailyMetrics();
  const cutoff = easternDateString(new Date(Date.now() - WINDOW_DAYS * 864e5));
  const today = easternDateString();

  // Only days the team actually left a "Changes Made Today" note, newest first.
  const days = marketing
    .filter((r) => {
      const d = toEasternDateOnly(r.date);
      return (
        d !== null &&
        d >= cutoff &&
        d <= today &&
        typeof r.changesMadeToday === "string" &&
        r.changesMadeToday.trim() !== ""
      );
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .map((row) => ({
      date: toEasternDateOnly(row.date),
      changesMadeToday: row.changesMadeToday,
      metrics: {
        adSpend: row.adSpendMeta,
        costPerLead: row.costPerLeadMeta,
        landingPageConnectRate: row.landingPageConnectRate,
        vslViews: row.vslViews,
        vslPlayRate: row.vslPlayRate,
        vslEngagementRate: row.vslEngagementRate,
        dials: row.dials,
        connectionRate: row.connectionRate,
        sales: row.salesLowTicket,
        cashCollected: row.cashCollectedLowTicket,
        closeRate: row.closeRateLowTicket,
        funnelConversionRate: row.funnelConversionRate,
      },
    }));

  return Response.json({ days });
}
