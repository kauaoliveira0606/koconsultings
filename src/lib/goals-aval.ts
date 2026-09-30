import type { GoalsConfig } from "./goals";

/**
 * Aval's own targets — kept separate from Bronson's `goals.ts` since they're
 * a different offer. Confirmed KPI targets set 2026-09-22: connection rate
 * 30%, opt-in rate 20%, close rate 35% (both low- and high-ticket), overall
 * funnel conversion rate 10%. Everything else still has no confirmed target,
 * so it stays null (renders as "No goal set") instead of borrowing a number
 * that was never verified for this offer.
  *
 * Client KPI targets updated 2026-09-29 (same across all 3 client dashboards):
 * show rate 70%, close rate 35%, low-ticket close rate 40%, VSL play rate
 * 60%, engagement rate 40%, CAC $100, attribution rate 90%, landing page
 * connect rate 80%, ROAS 3x, connection rate 40%, yearly share 30%, cost per
 * lead $15.
 */
export async function getAvalGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    costPerLeadMeta: { max: 15 },
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
    optInRate: { min: 0.2 },
    vslPlayRate: { min: 0.6 },
    vslEngagementRate: { min: 0.4 },
    connectionRate: { min: 0.4 },
    highTicketCloseRate: { min: 0.35 },
    showRate: { min: 0.7 },
    attributionRate: { min: 0.9 },
    yearlyShare: { min: 0.3 },
    speedToLeadMinutes: { max: 5 },
  };
}
