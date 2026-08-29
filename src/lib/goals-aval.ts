import type { GoalsConfig } from "./goals";

/**
 * No confirmed targets exist for Aval yet, so every goal is null (renders
 * as "No goal set") instead of borrowing Bronson's numbers, which belong to
 * a different offer.
 */
export async function getAvalGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    costPerLeadMeta: null,
    cashCollectedLowTicket: null,
    funnelConversionRate: null,
    roasTotal: null,
    roasLowTicket: null,
    cpaLowTicket: null,
    totalCashCollected: null,
    optInsPaid: null,
    optInsOrganic: null,
    vslViews: null,
    dials: null,
    salesLowTicket: null,
    closeRateLowTicket: null,
    landingPageConnectRate: null,
    optInRate: null,
    vslPlayRate: null,
    vslEngagementRate: null,
    confirmationEmailOpenRate: null,
    connectionRate: null,
  };
}
