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
  confirmationEmailOpenRate: { min: number } | null;
  connectionRate: { min: number } | null;
};

/**
 * Hardcoded defaults matching the reference dashboard's screenshot.
 * Isolated behind this function so swapping to an Airtable-backed or
 * config-file source later is a one-function change, not a UI rewrite.
 * TODO: confirm real target numbers with the client before relying on these.
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
    closeRateLowTicket: { min: 0.4 },
    landingPageConnectRate: { min: 0.8 },
    optInRate: { min: 0.3 },
    vslPlayRate: { min: 0.7 },
    vslEngagementRate: { min: 0.4 },
    confirmationEmailOpenRate: { min: 0.4 },
    connectionRate: { min: 0.2 },
  };
}
