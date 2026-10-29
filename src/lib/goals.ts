/**
 * A "min" goal is green at or above `min`. With `redBelow` it turns red only
 * under that line and is yellow in between; without it, red starts 20% under
 * the goal (the original scale). "max" goals mirror this with `redAbove`.
 */
export type MinGoal = { min: number; redBelow?: number };
export type MaxGoal = { max: number; redAbove?: number };

export type GoalsConfig = {
  adSpendMeta: number | null;
  costPerLeadMeta: MaxGoal | null;
  cashCollectedLowTicket: number | null;
  funnelConversionRate: MinGoal | null;
  roasTotal: MinGoal | null;
  roasLowTicket: MinGoal | null;
  cpaLowTicket: MaxGoal | null;
  totalCashCollected: number | null;
  optInsPaid: number | null;
  optInsOrganic: number | null;
  vslViews: number | null;
  dials: number | null;
  salesLowTicket: number | null;
  closeRateLowTicket: MinGoal | null;
  landingPageConnectRate: MinGoal | null;
  optInRate: MinGoal | null;
  vslPlayRate: MinGoal | null;
  vslEngagementRate: MinGoal | null;
  connectionRate: MinGoal | null;
  showRate?: MinGoal | null;
  highTicketCloseRate?: MinGoal | null;
  attributionRate?: MinGoal | null;
  yearlyShare?: MinGoal | null;
  /** Average minutes from opt-in to first rep call. */
  speedToLeadMinutes?: MaxGoal | null;
  /** Touch points (double-dial = 1) per lead in its first 14 days. */
  touchPointsPerLead?: MinGoal | null;
  // Ad / webinar KPIs (user's good/bad lines, 2026-10-14).
  webinarOptInRate?: MinGoal | null;
  /** VIP take rate, applied to both paid and organic. */
  vipTakeRate?: MinGoal | null;
  hookRate?: MinGoal | null;
  holdRate?: MinGoal | null;
  linkClickThroughRate?: MinGoal | null;
  cpm?: MaxGoal | null;
  adFrequency?: MaxGoal | null;
};

/**
 * Bronson's targets. Isolated behind this function so swapping to an
 * Airtable-backed or config-file source later is a one-function change, not
 * a UI rewrite. Confirmed KPI targets set 2026-09-22: connection rate 30%,
 * opt-in rate 20%, close rate 35% (both low- and high-ticket), overall
 * funnel conversion rate 10%.
  *
 * Client KPI targets updated 2026-09-29 (same across all 3 client dashboards):
 * show rate 70%, close rate 35%, low-ticket close rate 40%, VSL play rate
 * 50%, engagement rate 20% (both updated 2026-10-23), CAC $100, attribution rate 90%, landing page
 * connect rate 80%, ROAS 3x, connection rate 40%, yearly share 30%, cost per
 * lead $15.
 */
export async function getGoals(): Promise<GoalsConfig> {
  return {
    adSpendMeta: null,
    // Webinar cost per lead (registration), user's line 2026-10-29: good
    // under $10, red over $12, yellow between.
    costPerLeadMeta: { max: 10, redAbove: 12 },
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
    // User's KPI lines, 2026-10-14 (both offers): good / bad, yellow between.
    landingPageConnectRate: { min: 0.8, redBelow: 0.7 },
    optInRate: { min: 0.2 },
    webinarOptInRate: { min: 0.3, redBelow: 0.2 },
    hookRate: { min: 0.3, redBelow: 0.3 },
    holdRate: { min: 0.25, redBelow: 0.15 },
    linkClickThroughRate: { min: 0.02, redBelow: 0.005 },
    cpm: { max: 20, redAbove: 80 },
    adFrequency: { max: 2, redAbove: 3.5 },
    vslPlayRate: { min: 0.5 },
    vslEngagementRate: { min: 0.2 },
    connectionRate: { min: 0.4 },
    showRate: { min: 0.7 },
    highTicketCloseRate: { min: 0.35 },
    attributionRate: { min: 0.9 },
    yearlyShare: { min: 0.3 },
    speedToLeadMinutes: { max: 5 },
    touchPointsPerLead: { min: 5 },
  };
}
