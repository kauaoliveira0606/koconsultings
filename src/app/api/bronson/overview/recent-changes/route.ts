import { getBronsonAffiliateEod, getLeads, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { easternDateString, toEasternDateOnly } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";

// Always needs live Airtable data.
export const dynamic = "force-dynamic";
export const revalidate = 60;

const WINDOW_DAYS = 14;

export async function GET() {
  const [marketing, eod, leads] = await Promise.all([
    getMarketingDailyMetrics(),
    getBronsonAffiliateEod(),
    getLeads(),
  ]);
  const cutoff = easternDateString(new Date(Date.now() - WINDOW_DAYS * 864e5));
  const today = easternDateString();

  // Dials, pickups, and closed/pitched always come from Affiliate EOD
  // (summed across setters) when a day has one, never the manually-typed
  // form fields.
  const dialsByDate = new Map<string, number>();
  const pickupsByDate = new Map<string, number>();
  const closedByDate = new Map<string, number>();
  const pitchedByDate = new Map<string, number>();
  for (const r of eod) {
    const d = toEasternDateOnly(r.date);
    if (!d) continue;
    if (r.outboundDials !== null) dialsByDate.set(d, (dialsByDate.get(d) ?? 0) + r.outboundDials);
    if (r.pickups !== null) pickupsByDate.set(d, (pickupsByDate.get(d) ?? 0) + r.pickups);
    if (r.softwareClosed !== null) closedByDate.set(d, (closedByDate.get(d) ?? 0) + r.softwareClosed);
    if (r.softwarePitched !== null)
      pitchedByDate.set(d, (pitchedByDate.get(d) ?? 0) + r.softwarePitched);
  }
  // Total opt-ins per day from the Leads table (every tracked lead, paid + organic).
  const leadsByDate = new Map<string, number>();
  for (const l of leads) {
    const d = toEasternDateOnly(l.createdAt);
    if (!d) continue;
    leadsByDate.set(d, (leadsByDate.get(d) ?? 0) + 1);
  }

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
    .map((row) => {
      const d = toEasternDateOnly(row.date);
      const pickups = d ? pickupsByDate.get(d) : undefined;
      const optIns = d ? leadsByDate.get(d) : undefined;
      const closed = d ? closedByDate.get(d) : undefined;
      const pitched = d ? pitchedByDate.get(d) : undefined;
      return {
        date: d,
        changesMadeToday: row.changesMadeToday,
        metrics: {
          adSpend: row.adSpendMeta,
          costPerLead: row.costPerLeadMeta,
          landingPageConnectRate: row.landingPageConnectRate,
          vslViews: row.vslViews,
          vslPlayRate: row.vslPlayRate,
          vslEngagementRate: row.vslEngagementRate,
          dials: (d && dialsByDate.get(d)) ?? row.dials,
          connectionRate: safeDivide(pickups ?? null, optIns || null) ?? row.connectionRate,
          sales: row.salesLowTicket,
          cashCollected: row.cashCollectedLowTicket,
          closeRate: safeDivide(closed ?? null, pitched || null) ?? row.closeRateLowTicket,
          funnelConversionRate: row.funnelConversionRate,
        },
      };
    });

  return Response.json({ days });
}
