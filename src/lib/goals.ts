export type GoalsConfig = {
  adSpendMeta: number | null;
  costPerLeadMeta: { max: number } | null;
  cashCollectedLowTicket: number | null;
  funnelConversionRate: { min: number } | null;
  roasTotal: { min: number } | null;
  roasLowTicket: { min: number } | null;
  cpaLowTicket: { max: number } | null;
  totalCashCollected: number | null;
  optInsPaid: number | null;
  optInsOrganic: number | null;
  vslViews: number | null;
  dials: number | null;
  salesLowTicket: number | null;
  closeRateLowTicket: { min: number } | null;
  landingPageConnectRate: { min: number } | null;
  optInRate: { min: number } | null;
  vslPlayRate: { min: number } | null;
  vslEngagementRate: { min: number } | null;
  connectionRate: { min: number } | null;
  showRate?: { min: number } | null;
  highTicketCloseRate?: { min: number } | null;
};

/**
 * Bronson's targets. Isolated behind this function so swapping to an
 * Airtable-backed or config-file source later is a one-function change, not
 * a UI rewrite. Confirmed KPI targets set 2026-09-22: connection rate 30%,
 * opt-in rate 20%, close rate 35% (both low- and high-ticket), overall
 * funnel conversion rate 10%.
 */
export async function getGoals(): Promise<GoalsConfig> {
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
    closeRateLowTicket: { min: 0.35 },
    landingPageConnectRate: { min: 0.8 },
    optInRate: { min: 0.2 },
    vslPlayRate: { min: 0.7 },
    vslEngagementRate: { min: 0.4 },
    connectionRate: { min: 0.3 },
    showRate: { min: 0.7 },
    highTicketCloseRate: { min: 0.35 },
  };
}
