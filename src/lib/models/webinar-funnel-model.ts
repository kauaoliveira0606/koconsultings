/**
 * Webinar funnel model, read top to bottom:
 * Ad spend -> Ads (CPM, CTR, opt-in rate -> CPL) -> registrants -> show rate -> retention to pitch
 * -> booking rate -> call show rate -> call close rate -> AOV.
 * All rates are fractions 0-1.
 */
export type WebinarFunnelInputs = {
  adSpend: number; // monthly budget; registrants = ad spend / CPL
  cpm: number; // $ per 1,000 impressions
  ctr: number; // link clicks / impressions
  optInRate: number; // registrations / link clicks
  cplOverride: number | null; // null = auto-calculated from CPM, CTR, opt-in rate
  showRate: number; // registrants who attend live
  retentionRate: number; // attendees who stay to the pitch
  bookingRate: number; // stayed-to-pitch who book a call
  callShowRate: number; // booked calls that show
  closeRate: number; // showed calls that close
  aov: number;
  // Optional VIP package (paid upgrade bought by registrants)
  vipEnabled: boolean;
  vipPrice: number;
  vipTakeRate: number; // registrants who buy the VIP package
};

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/** CPL = cost per click / opt-in rate, where cost per click = (CPM / 1000) / CTR. */
export function autoCpl(cpm: number, ctr: number, optInRate: number): number {
  return ratio(ratio(cpm / 1000, ctr), optInRate);
}

export function computeWebinarFunnel(inputs: WebinarFunnelInputs) {
  const calculatedCpl = autoCpl(inputs.cpm, inputs.ctr, inputs.optInRate);
  const cpl = inputs.cplOverride ?? calculatedCpl;

  const adSpend = inputs.adSpend;
  const registrants = ratio(adSpend, cpl);
  const attendees = registrants * inputs.showRate;
  const stayedToPitch = attendees * inputs.retentionRate;
  const callsBooked = stayedToPitch * inputs.bookingRate;
  const callsShowed = callsBooked * inputs.callShowRate;
  const buyers = callsShowed * inputs.closeRate;

  const htRevenue = buyers * inputs.aov;
  const vipBuyers = inputs.vipEnabled ? registrants * inputs.vipTakeRate : 0;
  const vipRevenue = vipBuyers * (inputs.vipEnabled ? inputs.vipPrice : 0);
  const revenue = htRevenue + vipRevenue;

  return {
    calculatedCpl,
    cpl,
    registrants,
    attendees,
    stayedToPitch,
    callsBooked,
    callsShowed,
    buyers,
    htRevenue,
    vipBuyers,
    vipRevenue,
    revenue,
    adSpend,
    revenuePerAttendee: ratio(revenue, attendees),
    revenuePerRegistrant: ratio(revenue, registrants),
    cpa: ratio(adSpend, buyers),
    costPerCall: ratio(adSpend, callsBooked),
    roas: ratio(revenue, adSpend),
    profit: revenue - adSpend,
    vipRevenueToAdSpend: ratio(vipRevenue, adSpend),
  };
}
