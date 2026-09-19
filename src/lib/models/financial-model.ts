export type FinancialModelInputs = {
  // Step 1
  revenueTarget: number; // per month
  aov: number; // low-ticket AOV
  // Step 2
  closeRate: number; // fraction 0-1, first call
  attributionRate: number; // fraction 0-1: share of closed deals we actually get paid on
  // Step 3
  connectRate: number; // fraction 0-1
  // Step 4
  costPerLead: number;
  // Step 5
  contactsPerRepPerDay: number;
  workingDaysPerMonth: number;
  // Step 7
  salesCommissionRate: number; // fraction 0-1, of Revenue Target
  repBaseSalary: number; // per rep, per month
  deliveryCostPerSale: number;
  fixedMonthlyExpenses: number;
};

export type CapacityCheck = "OK" | "UNDERSTAFFED";

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function computeFinancialModel(inputs: FinancialModelInputs) {
  // Step 1: revenue target -> deals required
  const dealsRequired = ratio(inputs.revenueTarget, inputs.aov);

  // Step 2: deals required -> connected calls required
  const connectedCallsRequired = ratio(
    dealsRequired,
    inputs.closeRate * inputs.attributionRate
  );

  // Step 3: connected calls -> leads required
  const leadsRequired = ratio(connectedCallsRequired, inputs.connectRate);

  // Step 4: leads -> ad spend required
  const adSpendRequired = leadsRequired * inputs.costPerLead;

  // Step 5: deals -> reps required
  const dealsPerRepPerMonth =
    inputs.contactsPerRepPerDay *
    inputs.workingDaysPerMonth *
    inputs.closeRate *
    inputs.attributionRate;
  const repsRequired = ratio(dealsRequired, dealsPerRepPerMonth);
  // Epsilon so float noise (e.g. 2.0000000001) doesn't round a whole number of reps up.
  const repsRequiredRoundUp = Math.ceil(repsRequired - 1e-9);

  // Step 6: validate capacity
  const totalConnectedCallCapacity =
    repsRequiredRoundUp * inputs.contactsPerRepPerDay * inputs.workingDaysPerMonth;
  const capacityCheck: CapacityCheck =
    totalConnectedCallCapacity >= connectedCallsRequired - 1e-9 ? "OK" : "UNDERSTAFFED";

  // Step 7: costs
  const adSpend = adSpendRequired;
  const salesCommission = inputs.revenueTarget * inputs.salesCommissionRate;
  const totalRepBaseSalary = repsRequiredRoundUp * inputs.repBaseSalary;
  const totalDeliveryCost = dealsRequired * inputs.deliveryCostPerSale;
  const fixedExpenses = inputs.fixedMonthlyExpenses;
  const totalCosts =
    adSpend + salesCommission + totalRepBaseSalary + totalDeliveryCost + fixedExpenses;

  // Step 8: profit
  const grossRevenue = dealsRequired * inputs.attributionRate * inputs.aov;
  const netProfit = grossRevenue - totalCosts;
  const roas = ratio(grossRevenue, adSpend);
  const profitMargin = ratio(netProfit, grossRevenue);
  const cpa = ratio(adSpend, dealsRequired * inputs.attributionRate);

  // Step 9: break-even sensitivity
  const nonAdCosts = salesCommission + totalRepBaseSalary + totalDeliveryCost + fixedExpenses;
  const maxTolerableCpl = ratio(grossRevenue - nonAdCosts, leadsRequired);
  const minimumCloseRate = ratio(
    totalCosts,
    connectedCallsRequired * inputs.attributionRate * inputs.aov
  );
  const minimumAttributionRate = ratio(totalCosts, dealsRequired * inputs.aov);
  const minimumAov = ratio(totalCosts, dealsRequired * inputs.attributionRate);

  return {
    dealsRequired,
    connectedCallsRequired,
    leadsRequired,
    adSpendRequired,
    dealsPerRepPerMonth,
    repsRequired,
    repsRequiredRoundUp,
    totalConnectedCallCapacity,
    capacityCheck,
    adSpend,
    salesCommission,
    totalRepBaseSalary,
    totalDeliveryCost,
    fixedExpenses,
    totalCosts,
    grossRevenue,
    netProfit,
    roas,
    profitMargin,
    cpa,
    maxTolerableCpl,
    minimumCloseRate,
    minimumAttributionRate,
    minimumAov,
  };
}

/**
 * Downside scenarios degrade the conversion rates (connect, close, attribution)
 * by `factor` and inflate Cost Per Lead by the complementary amount (factor 0.85
 * -> rates x0.85, CPL x1.15). The revenue target, AOV and costs are left untouched.
 */
export function applyDownside(
  inputs: FinancialModelInputs,
  factor: 0.85 | 0.7
): FinancialModelInputs {
  return {
    ...inputs,
    costPerLead: inputs.costPerLead * (2 - factor),
    connectRate: inputs.connectRate * factor,
    closeRate: inputs.closeRate * factor,
    attributionRate: inputs.attributionRate * factor,
  };
}
