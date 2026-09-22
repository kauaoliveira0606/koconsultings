import type { GoalsConfig } from "./goals";

/**
 * Aval's own targets — kept separate from Bronson's `goals.ts` since they're
 * a different offer. Confirmed KPI targets set 2026-09-22: connection rate
 * 30%, opt-in rate 20%, close rate 35% (both low- and high-ticket), overall
 * funnel conversion rate 10%. Everything else still has no confirmed target,
 * so it stays null (renders as "No goal set") instead of borrowing a number
 * that was never verified for this offer.
 */
export async function getAvalGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    costPerLeadMeta: null,
    cashCollectedLowTicket: null,
    funnelConversionRate: { min: 0.1 },
    roasTotal: null,
    roasLowTicket: null,
    cpaLowTicket: null,
    totalCashCollected: null,
    optInsPaid: null,
    optInsOrganic: null,
    vslViews: null,
    dials: null,
    salesLowTicket: null,
    closeRateLowTicket: { min: 0.35 },
    landingPageConnectRate: null,
    optInRate: { min: 0.2 },
    vslPlayRate: null,
    vslEngagementRate: null,
    connectionRate: { min: 0.3 },
    highTicketCloseRate: { min: 0.35 },
  };
}
