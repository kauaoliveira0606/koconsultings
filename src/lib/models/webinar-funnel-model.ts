/**
 * Webinar funnel model, read top to bottom:
 * Ads (CPM, CTR, opt-in rate -> CPL) -> registrants -> show rate -> retention to pitch
 * -> booking rate -> call show rate -> call close rate -> AOV.
 * All rates are fractions 0-1.
 */
export type WebinarFunnelInputs = {
  cpm: number; // $ per 1,000 impressions
  ctr: number; // link clicks / impressions
  optInRate: number; // registrations / link clicks
  cplOverride: number | null; // null = auto-calculated from CPM, CTR, opt-in rate
  registrants: number;
  showRate: number; // registrants who attend live
  retentionRate: number; // attendees who stay to the pitch
  bookingRate: number; // stayed-to-pitch who book a call
  callShowRate: number; // booked calls that show
  closeRate: number; // showed calls that close
  aov: number;
};

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/** CPL = cost per click / opt-in rate, where cost per click = (CPM / 1000) / CTR. */
export function autoCpl(cpm: number, ctr: number, optInRate: number): number {
  return ratio(ratio(cpm / 1000, ctr), optInRate);
}

export function computeWebinarFunnel(inputs: WebinarFunnelInputs) {
  const calculatedCpl = autoCpl(inputs.cpm, inputs.ctr, inputs.optInRate);
  const cpl = inputs.cplOverride ?? calculatedCpl;

  const registrants = inputs.registrants;
  const attendees = registrants * inputs.showRate;
  const stayedToPitch = attendees * inputs.retentionRate;
  const callsBooked = stayedToPitch * inputs.bookingRate;
  const callsShowed = callsBooked * inputs.callShowRate;
  const buyers = callsShowed * inputs.closeRate;

  const revenue = buyers * inputs.aov;
  const adSpend = registrants * cpl;

  return {
    calculatedCpl,
    cpl,
    registrants,
    attendees,
    stayedToPitch,
    callsBooked,
    callsShowed,
    buyers,
    revenue,
    adSpend,
    revenuePerAttendee: ratio(revenue, attendees),
    revenuePerRegistrant: ratio(revenue, registrants),
    cpa: ratio(adSpend, buyers),
    costPerCall: ratio(adSpend, callsBooked),
    roas: ratio(revenue, adSpend),
    profit: revenue - adSpend,
  };
}
