export type FinancialModelInputs = {
  // Step 1
  revenueTarget: number; // total, per month
  htAov: number;
  // Step 2
  upsellCloseRate: number; // fraction 0-1
  upsellContactRate: number; // fraction 0-1
  activationRate: number; // fraction 0-1
  attributionRate: number; // fraction 0-1: share of deals we actually get paid on
  // Step 3
  closeRate: number; // fraction 0-1, first call
  // Step 4
  connectRate: number; // fraction 0-1
  // Step 5
  costPerLead: number;
  // Step 6
  contactsPerRepPerDay: number;
  workingDaysPerMonth: number;
  upsellCallsPerRepPerDay: number;
  // Step 7
  ltAov: number;
  // Step 8
  ltCommissionRate: number; // fraction 0-1, of low-ticket revenue
  htCommissionRate: number; // fraction 0-1, of high-ticket revenue
  repBaseSalary: number; // per rep, per month
  ltDeliveryCost: number; // per low-ticket sale
  htDeliveryCost: number; // per high-ticket sale
  fixedMonthlyExpenses: number;
};

export type RevenueCheck = "OK" | "SHORTFALL";
export type SelfLiquidationCheck = "YES" | "NO";

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function computeFinancialModel(inputs: FinancialModelInputs) {
  const attr = inputs.attributionRate;

  // Steps 1-2 are circular as written: High-Ticket Deals = (Target - LT Revenue) / HT AOV,
  // but LT Revenue = LT Deals x Attribution x LT AOV and LT Deals = HT Deals / upsellPath.
  // The formulas are linear, so they have one solution. Every HT deal comes with
  // 1/upsellPath LT deals, each paying Attribution x LT AOV, so:
  //   HT Deals = Target / (HT AOV + Attribution x LT AOV / upsellPath)
  const upsellPath =
    inputs.upsellCloseRate * inputs.upsellContactRate * inputs.activationRate * attr;
  const revenuePerHtDeal = inputs.htAov + ratio(attr * inputs.ltAov, upsellPath);

  // Step 1: revenue target -> high-ticket deals required
  const htDealsRequired = upsellPath > 0 ? ratio(inputs.revenueTarget, revenuePerHtDeal) : 0;

  // Step 2: high-ticket deals -> low-ticket deals required
  const ltDealsRequired = ratio(htDealsRequired, upsellPath);

  // Step 3: low-ticket deals -> connected calls required
  const connectedCallsRequired = ratio(ltDealsRequired, inputs.closeRate * attr);

  // Step 4: connected calls -> leads required
  const leadsRequired = ratio(connectedCallsRequired, inputs.connectRate);

  // Step 5: leads -> ad spend required
  const adSpendRequired = leadsRequired * inputs.costPerLead;

  // Step 6: deals -> reps required
  const frontEndDealsPerRepPerMonth =
    inputs.contactsPerRepPerDay * inputs.workingDaysPerMonth * inputs.closeRate * attr;
  const frontEndRepsRequired = ratio(ltDealsRequired, frontEndDealsPerRepPerMonth);
  const upsellDealsPerRepPerMonth =
    inputs.upsellCallsPerRepPerDay * inputs.workingDaysPerMonth * inputs.upsellCloseRate;
  const backendRepsRequired = ratio(htDealsRequired, upsellDealsPerRepPerMonth);

  // Step 7: revenue breakdown
  const ltRevenue = ltDealsRequired * attr * inputs.ltAov;
  const htRevenue = htDealsRequired * inputs.htAov;
  const totalGrossRevenue = ltRevenue + htRevenue;
  const revenueCheck: RevenueCheck =
    totalGrossRevenue >= inputs.revenueTarget - 1e-6 ? "OK" : "SHORTFALL";

  // Step 8: costs
  const adSpend = adSpendRequired;
  const totalCommission =
    ltRevenue * inputs.ltCommissionRate + htRevenue * inputs.htCommissionRate;
  const totalRepBaseSalary = (frontEndRepsRequired + backendRepsRequired) * inputs.repBaseSalary;
  const totalDeliveryCost =
    ltDealsRequired * inputs.ltDeliveryCost + htDealsRequired * inputs.htDeliveryCost;
  const fixedExpenses = inputs.fixedMonthlyExpenses;
  const totalCosts =
    adSpend + totalCommission + totalRepBaseSalary + totalDeliveryCost + fixedExpenses;

  // Step 9: profit & self-liquidation
  const netProfit = totalGrossRevenue - totalCosts;
  const roas = ratio(totalGrossRevenue, adSpend);
  const profitMargin = ratio(netProfit, totalGrossRevenue);
  const selfLiquidationCheck: SelfLiquidationCheck = ltRevenue >= adSpend ? "YES" : "NO";
  const ltRevenueToAdSpend = ratio(ltRevenue, adSpend);
  const attributedLtDeals = ltDealsRequired * attr;
  const blendedCpa = ratio(adSpend, attributedLtDeals + htDealsRequired);
  const htDealRate = ratio(htDealsRequired, attributedLtDeals);

  // Step 10: break-even sensitivity
  const costsLessLt = totalCosts - ltRevenue;
  const minimumActivationRate = ratio(
    costsLessLt,
    attributedLtDeals * inputs.upsellContactRate * inputs.upsellCloseRate * inputs.htAov
  );
  const minimumUpsellCloseRate = ratio(
    costsLessLt,
    attributedLtDeals * inputs.activationRate * inputs.upsellContactRate * inputs.htAov
  );
  const minimumHtAov = ratio(
    costsLessLt,
    attributedLtDeals * inputs.activationRate * inputs.upsellContactRate * inputs.upsellCloseRate
  );
  const minimumAttributionRate = ratio(
    totalCosts - htRevenue,
    ltDealsRequired * inputs.activationRate * inputs.ltAov
  );

  return {
    htDealsRequired,
    ltDealsRequired,
    connectedCallsRequired,
    leadsRequired,
    adSpendRequired,
    frontEndDealsPerRepPerMonth,
    frontEndRepsRequired,
    upsellDealsPerRepPerMonth,
    backendRepsRequired,
    ltRevenue,
    htRevenue,
    totalGrossRevenue,
    revenueCheck,
    adSpend,
    totalCommission,
    totalRepBaseSalary,
    totalDeliveryCost,
    fixedExpenses,
    totalCosts,
    netProfit,
    roas,
    profitMargin,
    selfLiquidationCheck,
    ltRevenueToAdSpend,
    blendedCpa,
    htDealRate,
    minimumActivationRate,
    minimumUpsellCloseRate,
    minimumHtAov,
    minimumAttributionRate,
  };
}

/**
 * Downside scenarios degrade every conversion rate (connect, close, attribution,
 * upsell close, upsell contact, activation) by `factor` and inflate Cost Per Lead
 * by the complementary amount (factor 0.85 -> rates x0.85, CPL x1.15). The revenue
 * target, AOVs and costs are left untouched.
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
    upsellCloseRate: inputs.upsellCloseRate * factor,
    upsellContactRate: inputs.upsellContactRate * factor,
    activationRate: inputs.activationRate * factor,
  };
}
