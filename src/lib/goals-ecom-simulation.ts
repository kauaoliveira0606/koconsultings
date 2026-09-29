import type { GoalsConfig } from "./goals";

/**
 * Ecom Simulation (Andy) targets, split out from Bronson's `goals.ts` so a
 * KPI change for one offer doesn't silently change the other's — they were
 * previously sharing the same hardcoded defaults. Values below are exactly
 * what Ecom Simulation was already showing at the time of the split
 * (2026-09-22); update independently from Bronson/Aval from here on.
  *
 * Client KPI targets updated 2026-09-29 (same across all 3 client dashboards):
 * show rate 70%, close rate 35%, low-ticket close rate 40%, VSL play rate
 * 60%, engagement rate 40%, CAC $100, attribution rate 90%, landing page
 * connect rate 80%, ROAS 3x, connection rate 40%, yearly share 30%.
 */
export async function getEcomSimulationGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    costPerLeadMeta: { max: 5 },
    cashCollectedLowTicket: null,
    funnelConversionRate: { min: 0.1 },
    roasTotal: { min: 3 },
    roasLowTicket: { min: 3 },
    cpaLowTicket: { max: 100 },
    totalCashCollected: null,
    optInsPaid: null,
    optInsOrganic: null,
    vslViews: null,
    dials: null,
    salesLowTicket: null,
    closeRateLowTicket: { min: 0.4 },
    landingPageConnectRate: { min: 0.8 },
    optInRate: { min: 0.3 },
    vslPlayRate: { min: 0.6 },
    vslEngagementRate: { min: 0.4 },
    connectionRate: { min: 0.4 },
    showRate: { min: 0.7 },
    highTicketCloseRate: { min: 0.35 },
    attributionRate: { min: 0.9 },
    yearlyShare: { min: 0.3 },
  };
}
