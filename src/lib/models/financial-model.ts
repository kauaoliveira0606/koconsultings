export type FinancialModelInputs = {
  adSpend: number;
  costPerLead: number;
  connectionRate: number; // fraction 0-1
  closeRate: number; // fraction 0-1
  attributionRate: number; // fraction 0-1
  avgCashPerSale: number;
  includeHighTicket: boolean;
  ltToHtRate: number; // fraction 0-1
  htAov: number;
};

export type FinancialModelRow = {
  key: string;
  label: string;
  value: number;
};

export const WEEKLY_MULTIPLIER = 7;
export const MONTHLY_MULTIPLIER = 30;

function computeCore(inputs: FinancialModelInputs) {
  const optIns = inputs.costPerLead > 0 ? inputs.adSpend / inputs.costPerLead : 0;
  const pickups = optIns * inputs.connectionRate;
  const sales = pickups * inputs.closeRate;
  const attributedSales = sales * inputs.attributionRate;
  const lowTicketCashCollected = attributedSales * inputs.avgCashPerSale;

  let highTicketBookings = 0;
  let highTicketCashCollected = 0;
  if (inputs.includeHighTicket) {
    highTicketBookings = sales * inputs.ltToHtRate;
    highTicketCashCollected = highTicketBookings * inputs.htAov;
  }

  const totalCashCollected = lowTicketCashCollected + highTicketCashCollected;
  const roas = inputs.adSpend > 0 ? totalCashCollected / inputs.adSpend : 0;
  const netProfit = totalCashCollected - inputs.adSpend;

  return {
    optIns,
    pickups,
    sales,
    attributedSales,
    lowTicketCashCollected,
    highTicketBookings,
    highTicketCashCollected,
    totalCashCollected,
    roas,
    netProfit,
  };
}

export function computeFinancialModel(inputs: FinancialModelInputs) {
  return computeCore(inputs);
}

/**
 * Downside scenarios degrade conversion rates (connection, close,
 * attribution, LT->HT) by `factor`, and inflate Cost Per Lead by the
 * complementary amount (e.g. factor 0.85 -> rates x0.85, cost per lead
 * x1.15) — reverse-engineered from the reference dashboard's exact
 * screenshot numbers (Ad Spend $5000/Cost Per Lead $50 -> -15% Cost Per
 * Lead $57, -30% -> $65). Ad spend and avg-cash-per-sale/HT AOV are
 * left untouched.
 */
export function applyDownside(
  inputs: FinancialModelInputs,
  factor: 0.85 | 0.7
): FinancialModelInputs {
  return {
    ...inputs,
    costPerLead: inputs.costPerLead * (2 - factor),
    connectionRate: inputs.connectionRate * factor,
    closeRate: inputs.closeRate * factor,
    attributionRate: inputs.attributionRate * factor,
    ltToHtRate: inputs.ltToHtRate * factor,
  };
}

export function projectPeriod(dailyValue: number, multiplier: number): number {
  return dailyValue * multiplier;
}
