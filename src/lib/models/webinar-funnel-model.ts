export type WebinarFunnelInputs = {
  // Step 1
  revenueTarget: number; // per month
  htAov: number;
  // Step 2
  closeRate: number; // fraction 0-1: live attendees who buy the high-ticket offer
  // Step 3
  showRate: number; // fraction 0-1: registrants who attend live
  // Step 4
  costPerRegistration: number;
  // Step 5
  vipPrice: number;
  vipTakeRate: number; // fraction 0-1: registrants who add the VIP order bump
  // Step 7
  callBased: boolean; // false = direct-to-checkout, skip closer math
  callsPerCloserPerDay: number;
  workingDaysPerMonth: number;
  webinarCloseRate: number; // fraction 0-1: close rate on booked calls
  bookingRate: number; // fraction 0-1: attendees who book a call
  callShowRate: number; // fraction 0-1
  // Step 8
  salesCommissionRate: number; // fraction 0-1, of high-ticket revenue
  vipDeliveryCost: number; // per VIP buyer
  closerBaseSalary: number; // per closer, per month
  htDeliveryCost: number; // per high-ticket sale
  platformCosts: number;
  fixedMonthlyExpenses: number;
};

export type WebinarRevenueCheck = "OK" | "SHORTFALL";
export type WebinarSelfLiquidationCheck = "YES" | "NO";

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function computeWebinarFunnel(inputs: WebinarFunnelInputs) {
  // Step 1
  const htDealsRequired = ratio(inputs.revenueTarget, inputs.htAov);

  // Steps 2-4
  const attendeesRequired = ratio(htDealsRequired, inputs.closeRate);
  const registrationsRequired = ratio(attendeesRequired, inputs.showRate);
  const adSpendRequired = registrationsRequired * inputs.costPerRegistration;

  // Step 5
  const vipBuyers = registrationsRequired * inputs.vipTakeRate;
  const vipRevenue = vipBuyers * inputs.vipPrice;

  // Step 6
  const htRevenue = htDealsRequired * inputs.htAov;
  const totalGrossRevenue = htRevenue + vipRevenue;
  const revenueCheck: WebinarRevenueCheck =
    totalGrossRevenue >= inputs.revenueTarget - 1e-6 ? "OK" : "SHORTFALL";

  // Step 7: closer math is skipped for a direct-to-checkout webinar
  const callsPerWebinar = inputs.callBased ? attendeesRequired * inputs.bookingRate : 0;
  const dealsPerCloserPerMonth = inputs.callBased
    ? inputs.callsPerCloserPerDay *
      inputs.workingDaysPerMonth *
      inputs.callShowRate *
      inputs.webinarCloseRate
    : 0;
  const closersRequiredExact = inputs.callBased
    ? ratio(htDealsRequired, dealsPerCloserPerMonth)
    : 0;
  // Epsilon so float noise (e.g. 2.0000000001) doesn't round a whole number of closers up.
  const closersRequired = Math.ceil(closersRequiredExact - 1e-9);

  // Step 8
  const adSpend = adSpendRequired;
  const salesCommission = htRevenue * inputs.salesCommissionRate;
  const totalVipDeliveryCost = vipBuyers * inputs.vipDeliveryCost;
  const totalCloserBaseSalary = closersRequired * inputs.closerBaseSalary;
  const totalDeliveryCost = htDealsRequired * inputs.htDeliveryCost;
  const webinarPlatformCosts = inputs.platformCosts;
  const fixedExpenses = inputs.fixedMonthlyExpenses;
  const totalCosts =
    adSpend +
    salesCommission +
    totalVipDeliveryCost +
    totalCloserBaseSalary +
    totalDeliveryCost +
    webinarPlatformCosts +
    fixedExpenses;

  // Step 9
  const netProfit = totalGrossRevenue - totalCosts;
  const roas = ratio(totalGrossRevenue, adSpend);
  const profitMargin = ratio(netProfit, totalGrossRevenue);
  const costPerAttendee = ratio(adSpend, attendeesRequired);
  const costPerRegistration = inputs.costPerRegistration;
  const cpa = ratio(adSpend, htDealsRequired);
  const vipRevenueToAdSpend = ratio(vipRevenue, adSpend);
  const selfLiquidationCheck: WebinarSelfLiquidationCheck = vipRevenue >= adSpend ? "YES" : "NO";

  // Step 10
  const nonAdCosts =
    salesCommission +
    totalVipDeliveryCost +
    totalCloserBaseSalary +
    totalDeliveryCost +
    webinarPlatformCosts +
    fixedExpenses;
  const maxTolerableCpr = ratio(totalGrossRevenue - nonAdCosts, registrationsRequired);
  const costsLessVip = totalCosts - vipRevenue;
  const minimumShowRate = ratio(
    costsLessVip,
    registrationsRequired * inputs.closeRate * inputs.htAov
  );
  const minimumCloseRate = ratio(costsLessVip, attendeesRequired * inputs.htAov);
  const minimumVipTakeRate = ratio(
    totalCosts - htRevenue,
    registrationsRequired * inputs.vipPrice
  );
  const minimumHtAov = ratio(costsLessVip, htDealsRequired);

  return {
    htDealsRequired,
    attendeesRequired,
    registrationsRequired,
    adSpendRequired,
    vipBuyers,
    vipRevenue,
    htRevenue,
    totalGrossRevenue,
    revenueCheck,
    callsPerWebinar,
    dealsPerCloserPerMonth,
    closersRequiredExact,
    closersRequired,
    adSpend,
    salesCommission,
    totalVipDeliveryCost,
    totalCloserBaseSalary,
    totalDeliveryCost,
    webinarPlatformCosts,
    fixedExpenses,
    totalCosts,
    netProfit,
    roas,
    profitMargin,
    costPerAttendee,
    costPerRegistration,
    cpa,
    vipRevenueToAdSpend,
    selfLiquidationCheck,
    maxTolerableCpr,
    minimumShowRate,
    minimumCloseRate,
    minimumVipTakeRate,
    minimumHtAov,
  };
}

/**
 * Downside scenarios degrade every conversion rate by `factor` and inflate Cost Per
 * Registration by the complementary amount (factor 0.85 -> rates x0.85, CPR x1.15).
 * The revenue target, prices and costs are left untouched.
 */
export function applyWebinarDownside(
  inputs: WebinarFunnelInputs,
  factor: 0.85 | 0.7
): WebinarFunnelInputs {
  return {
    ...inputs,
    costPerRegistration: inputs.costPerRegistration * (2 - factor),
    closeRate: inputs.closeRate * factor,
    showRate: inputs.showRate * factor,
    vipTakeRate: inputs.vipTakeRate * factor,
    webinarCloseRate: inputs.webinarCloseRate * factor,
    bookingRate: inputs.bookingRate * factor,
    callShowRate: inputs.callShowRate * factor,
  };
}
