export type VslFunnelInputs = {
  // Step 1
  revenueTarget: number; // per month
  htAov: number;
  // Step 2
  closeRate: number; // fraction 0-1
  // Two-call close variant
  twoCallClose: boolean;
  secondCallBookingRate: number; // fraction 0-1: first-call attendees who book a second call
  secondCallShowRate: number; // fraction 0-1
  // Steps 3-6
  showRate: number; // fraction 0-1
  applicationToScheduleRate: number; // fraction 0-1
  vslToApplicationRate: number; // fraction 0-1
  vslPlayRate: number; // fraction 0-1
  // Step 7
  cpc: number;
  // Step 8
  callsPerCloserPerDay: number;
  workingDaysPerMonth: number;
  // Step 10
  salesCommissionRate: number; // fraction 0-1, of Revenue Target
  closerBaseSalary: number; // per closer, per month
  deliveryCostPerSale: number;
  fixedMonthlyExpenses: number;
};

export type VslCapacityCheck = "OK" | "UNDERSTAFFED";

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function computeVslFunnel(inputs: VslFunnelInputs) {
  // Step 1
  const dealsRequired = ratio(inputs.revenueTarget, inputs.htAov);

  // Step 2
  const shownCallsRequired = ratio(dealsRequired, inputs.closeRate);

  // Two-call close variant (between Steps 2 and 3)
  const adjustedShownCallsRequired = ratio(
    dealsRequired,
    inputs.closeRate * inputs.secondCallShowRate
  );
  const adjustedFirstCallShownRequired = ratio(
    adjustedShownCallsRequired,
    inputs.secondCallBookingRate
  );

  // Step 3: scheduled calls come off the first-call-shown basis
  const firstCallShownBasis = inputs.twoCallClose
    ? adjustedFirstCallShownRequired
    : shownCallsRequired;
  const scheduledCallsRequired = ratio(firstCallShownBasis, inputs.showRate);

  // Steps 4-7
  const applicationsRequired = ratio(scheduledCallsRequired, inputs.applicationToScheduleRate);
  const vslViewersRequired = ratio(applicationsRequired, inputs.vslToApplicationRate);
  const pageVisitorsRequired = ratio(vslViewersRequired, inputs.vslPlayRate);
  const adSpendRequired = pageVisitorsRequired * inputs.cpc;

  // Step 8
  const dealsPerCloserPerMonth =
    inputs.callsPerCloserPerDay *
    inputs.workingDaysPerMonth *
    inputs.showRate *
    inputs.closeRate;
  const closersRequiredExact = ratio(dealsRequired, dealsPerCloserPerMonth);
  // Epsilon so float noise (e.g. 2.0000000001) doesn't round a whole number of closers up.
  const closersRequired = Math.ceil(closersRequiredExact - 1e-9);

  // Step 9
  const totalCallCapacity =
    closersRequired * inputs.callsPerCloserPerDay * inputs.workingDaysPerMonth;
  const capacityCheck: VslCapacityCheck =
    totalCallCapacity >= scheduledCallsRequired - 1e-9 ? "OK" : "UNDERSTAFFED";

  // Step 10
  const adSpend = adSpendRequired;
  const salesCommission = inputs.revenueTarget * inputs.salesCommissionRate;
  const totalCloserBaseSalary = closersRequired * inputs.closerBaseSalary;
  const totalDeliveryCost = dealsRequired * inputs.deliveryCostPerSale;
  const fixedExpenses = inputs.fixedMonthlyExpenses;
  const totalCosts =
    adSpend + salesCommission + totalCloserBaseSalary + totalDeliveryCost + fixedExpenses;

  // Step 11
  const grossRevenue = dealsRequired * inputs.htAov;
  const netProfit = grossRevenue - totalCosts;
  const roas = ratio(grossRevenue, adSpend);
  const profitMargin = ratio(netProfit, grossRevenue);
  const costPerScheduledCall = ratio(adSpend, scheduledCallsRequired);
  const costPerShownCall = ratio(adSpend, shownCallsRequired);
  const cpa = ratio(adSpend, dealsRequired);
  const revenuePerCloserPerMonth = ratio(grossRevenue, closersRequired);

  // Step 12
  const nonAdCosts = salesCommission + totalCloserBaseSalary + totalDeliveryCost + fixedExpenses;
  const maxTolerableCpc = ratio(grossRevenue - nonAdCosts, pageVisitorsRequired);
  const minimumCloseRate = ratio(totalCosts, shownCallsRequired * inputs.htAov);
  const minimumShowRate = ratio(
    totalCosts,
    scheduledCallsRequired * inputs.closeRate * inputs.htAov
  );
  const minimumAov = ratio(totalCosts, dealsRequired);

  return {
    dealsRequired,
    shownCallsRequired,
    adjustedShownCallsRequired,
    adjustedFirstCallShownRequired,
    scheduledCallsRequired,
    applicationsRequired,
    vslViewersRequired,
    pageVisitorsRequired,
    adSpendRequired,
    dealsPerCloserPerMonth,
    closersRequiredExact,
    closersRequired,
    totalCallCapacity,
    capacityCheck,
    adSpend,
    salesCommission,
    totalCloserBaseSalary,
    totalDeliveryCost,
    fixedExpenses,
    totalCosts,
    grossRevenue,
    netProfit,
    roas,
    profitMargin,
    costPerScheduledCall,
    costPerShownCall,
    cpa,
    revenuePerCloserPerMonth,
    maxTolerableCpc,
    minimumCloseRate,
    minimumShowRate,
    minimumAov,
  };
}

/**
 * Downside scenarios degrade every conversion rate by `factor` and inflate Cost Per
 * Click by the complementary amount (factor 0.85 -> rates x0.85, CPC x1.15). The
 * revenue target, AOV and costs are left untouched.
 */
export function applyVslDownside(inputs: VslFunnelInputs, factor: 0.85 | 0.7): VslFunnelInputs {
  return {
    ...inputs,
    cpc: inputs.cpc * (2 - factor),
    closeRate: inputs.closeRate * factor,
    showRate: inputs.showRate * factor,
    applicationToScheduleRate: inputs.applicationToScheduleRate * factor,
    vslToApplicationRate: inputs.vslToApplicationRate * factor,
    vslPlayRate: inputs.vslPlayRate * factor,
    secondCallBookingRate: inputs.secondCallBookingRate * factor,
    secondCallShowRate: inputs.secondCallShowRate * factor,
  };
}
