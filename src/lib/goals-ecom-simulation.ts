import type { GoalsConfig } from "./goals";

/**
 * Ecom Simulation (Andy) targets, split out from Bronson's `goals.ts` so a
 * KPI change for one offer doesn't silently change the other's — they were
 * previously sharing the same hardcoded defaults. Values below are exactly
 * what Ecom Simulation was already showing at the time of the split
 * (2026-09-22); update independently from Bronson/Aval from here on.
 */
export async function getEcomSimulationGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    costPerLeadMeta: { max: 5 },
    cashCollectedLowTicket: null,
    funnelConversionRate: { min: 0.1 },
    roasTotal: { min: 3 },
    roasLowTicket: { min: 3 },
    cpaLowTicket: { max: 50 },
    totalCashCollected: null,
    optInsPaid: null,
    optInsOrganic: null,
    vslViews: null,
    dials: null,
    salesLowTicket: null,
    closeRateLowTicket: { min: 0.4 },
    landingPageConnectRate: { min: 0.8 },
    optInRate: { min: 0.3 },
    vslPlayRate: { min: 0.7 },
    vslEngagementRate: { min: 0.4 },
    connectionRate: { min: 0.2 },
    showRate: { min: 0.7 },
    highTicketCloseRate: { min: 0.3 },
  };
}
