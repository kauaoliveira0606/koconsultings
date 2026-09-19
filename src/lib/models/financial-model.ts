export type FinancialModelInputs = {
  monthlyAdSpend: number;
  costPerLead: number;
  reps: number; // full-cycle reps (headcount)
  contactsPerRepPerDay: number;
  workingDaysPerMonth: number;
  connectRate: number; // fraction 0-1
  closeRate: number; // fraction 0-1, first call
  attributionRate: number; // fraction 0-1: share of closed deals we actually get paid on
  aov: number; // low-ticket AOV
  salesCommissionRate: number; // fraction 0-1, of attributed gross revenue
  repBaseSalary: number; // per rep, per month
  deliveryCostPerDeal: number; // per attributed (paid) deal
  fixedMonthlyExpenses: number;
};

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function computeFinancialModel(inputs: FinancialModelInputs) {
  // Ad spend & lead generation
  const leadsGenerated = ratio(inputs.monthlyAdSpend, inputs.costPerLead);

  // Rep capacity & connect
  const totalConnectedCallCapacity =
    inputs.reps * inputs.contactsPerRepPerDay * inputs.workingDaysPerMonth;
  const actualConnectedCalls = Math.min(
    leadsGenerated * inputs.connectRate,
    totalConnectedCallCapacity
  );

  // Conversion
  const dealsClosed = actualConnectedCalls * inputs.closeRate;
  const attributedDeals = dealsClosed * inputs.attributionRate;

  // Revenue
  const grossRevenue = attributedDeals * inputs.aov;
  const lostRevenue = (dealsClosed - attributedDeals) * inputs.aov;

  // Costs
  const adSpend = inputs.monthlyAdSpend;
  const salesCommission = grossRevenue * inputs.salesCommissionRate;
  const totalRepBaseSalary = inputs.reps * inputs.repBaseSalary;
  const totalDeliveryCost = attributedDeals * inputs.deliveryCostPerDeal;
  const fixedExpenses = inputs.fixedMonthlyExpenses;
  const totalCosts =
    adSpend + salesCommission + totalRepBaseSalary + totalDeliveryCost + fixedExpenses;

  // Profit & ROAS
  const netProfit = grossRevenue - totalCosts;
  const roas = ratio(grossRevenue, adSpend);
  const profitMargin = ratio(netProfit, grossRevenue);
  const cpa = ratio(adSpend, attributedDeals);
  const revenuePerRep = ratio(grossRevenue, inputs.reps);
  const dealsPerRep = ratio(attributedDeals, inputs.reps);

  // Break-even sensitivity
  const nonAdCosts = salesCommission + totalRepBaseSalary + totalDeliveryCost + fixedExpenses;
  // Max ad spend the revenue can carry, spread over the leads it buys.
  const maxTolerableCpl = ratio(grossRevenue - nonAdCosts, leadsGenerated);
  const minimumCloseRate = ratio(
    totalCosts,
    actualConnectedCalls * inputs.attributionRate * inputs.aov
  );
  const minimumAttributionRate = ratio(totalCosts, dealsClosed * inputs.aov);
  const minimumAov = ratio(totalCosts, attributedDeals);

  return {
    leadsGenerated,
    totalConnectedCallCapacity,
    actualConnectedCalls,
    dealsClosed,
    attributedDeals,
    grossRevenue,
    lostRevenue,
    adSpend,
    salesCommission,
    totalRepBaseSalary,
    totalDeliveryCost,
    fixedExpenses,
    totalCosts,
    netProfit,
    roas,
    profitMargin,
    cpa,
    revenuePerRep,
    dealsPerRep,
    maxTolerableCpl,
    minimumCloseRate,
    minimumAttributionRate,
    minimumAov,
  };
}

/**
 * Downside scenarios degrade the conversion rates (connect, close, attribution)
 * by `factor` and inflate Cost Per Lead by the complementary amount (factor 0.85
 * -> rates x0.85, CPL x1.15). Spend, headcount, AOV and costs are left untouched.
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
