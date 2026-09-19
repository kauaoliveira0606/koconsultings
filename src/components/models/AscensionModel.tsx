"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  applyDownside,
  computeFinancialModel,
  type FinancialModelInputs,
} from "@/lib/models/financial-model";
import { usePersistedState } from "@/lib/use-persisted-state";
import { ModelTable, SectionRow, useModelRows } from "./model-table";

const DEFAULT_INPUTS: FinancialModelInputs = {
  revenueTarget: 100000,
  htAov: 5000,
  upsellCloseRate: 0.2,
  upsellContactRate: 0.65,
  activationRate: 0.4,
  attributionRate: 0.85,
  closeRate: 0.2,
  connectRate: 0.55,
  costPerLead: 10,
  contactsPerRepPerDay: 30,
  workingDaysPerMonth: 22,
  upsellCallsPerRepPerDay: 10,
  ltAov: 500,
  ltCommissionRate: 0.1,
  htCommissionRate: 0.1,
  repBaseSalary: 0,
  ltDeliveryCost: 0,
  htDeliveryCost: 0,
  fixedMonthlyExpenses: 0,
};

export function AscensionModel() {
  // "-v4": the model was rebuilt (low-ticket to high-ticket ascension), so numbers saved
  // by earlier versions must not carry over.
  const [inputs, setInputs] = usePersistedState<FinancialModelInputs>(
    `financial-model-v4:${usePathname()}:inputs`,
    DEFAULT_INPUTS
  );

  const d15 = useMemo(() => applyDownside(inputs, 0.85), [inputs]);
  const d30 = useMemo(() => applyDownside(inputs, 0.7), [inputs]);
  const results = useMemo(
    () => ({
      base: computeFinancialModel(inputs),
      d15: computeFinancialModel(d15),
      d30: computeFinancialModel(d30),
    }),
    [inputs, d15, d30]
  );

  const { input, row, check } = useModelRows({
    inputs,
    set: (patch) => setInputs((prev) => ({ ...prev, ...patch })),
    d15,
    d30,
    results,
  });
  const rate = { percent: true, scenario: true };

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold">Low-Ticket to High-Ticket Ascension</h2>
      <p className="mb-4 text-sm text-black/60">
        All numbers per month. Set a total revenue target and your funnel rates — this works
        backward to the high-ticket and low-ticket deals, calls, leads, ad spend and reps it takes,
        then the costs, profit and break-evens. Drag a slider or type a number directly. The -15% /
        -30% columns show what happens if every conversion rate drops that much and Cost Per Lead
        rises by the same amount.
      </p>

      <ModelTable>
        <SectionRow title="Step 1: Revenue Target → Deals Required" />
        {input("Total Revenue Target", "$", "revenueTarget", 0, 1000000, 1000)}
        {input("High-Ticket AOV", "$", "htAov", 0, 50000, 100)}
        {row("High-Ticket Deals Required", "#", "htDealsRequired", "number", true)}

        <SectionRow title="Step 2: High-Ticket Deals → Low-Ticket Deals Required" />
        {input("Upsell Close Rate", "%", "upsellCloseRate", 0, 100, 1, rate)}
        {input("Upsell Contact Rate", "%", "upsellContactRate", 0, 100, 1, rate)}
        {input("Activation Rate", "%", "activationRate", 0, 100, 1, rate)}
        {input("Attribution Rate (Share of Deals We Get Paid On)", "%", "attributionRate", 0, 100, 1, rate)}
        {row("Low-Ticket Deals Required", "#", "ltDealsRequired", "number", true)}

        <SectionRow title="Step 3: Low-Ticket Deals → Connected Calls Required" />
        {input("Close Rate (First Call)", "%", "closeRate", 0, 100, 1, rate)}
        {row("Connected Calls Required", "#", "connectedCallsRequired", "number", true)}

        <SectionRow title="Step 4: Connected Calls → Leads Required" />
        {input("Connect Rate (Share of Leads Reached by Phone)", "%", "connectRate", 0, 100, 1, rate)}
        {row("Leads Required", "#", "leadsRequired", "number", true)}

        <SectionRow title="Step 5: Leads Required → Ad Spend Required" />
        {input("Cost Per Lead (CPL)", "$", "costPerLead", 1, 500, 1, { scenario: true })}
        {row("Ad Spend Required", "$", "adSpendRequired", "currency", true)}

        <SectionRow title="Step 6: Deals Required → Reps Required" />
        {input("Contacts Per Rep Per Day", "#", "contactsPerRepPerDay", 0, 200, 1)}
        {input("Working Days Per Month", "#", "workingDaysPerMonth", 1, 31, 1)}
        {row("Front-End Deals Per Rep Per Month", "#", "frontEndDealsPerRepPerMonth", "number")}
        {row("Front-End Reps Required", "#", "frontEndRepsRequired", "number", true)}
        {input("Upsell Calls Per Rep Per Day", "#", "upsellCallsPerRepPerDay", 0, 100, 1)}
        {row("Upsell Deals Per Rep Per Month", "#", "upsellDealsPerRepPerMonth", "number")}
        {row("Backend Reps Required", "#", "backendRepsRequired", "number", true)}

        <SectionRow title="Step 7: Revenue Breakdown" />
        {input("Low-Ticket AOV", "$", "ltAov", 0, 5000, 10)}
        {row("Low-Ticket Revenue (Attributed)", "$", "ltRevenue", "currency")}
        {row("High-Ticket Revenue", "$", "htRevenue", "currency")}
        {row("Total Gross Revenue", "$", "totalGrossRevenue", "currency", true)}
        {check("Revenue Check", "OK / SHORTFALL", "OK", "revenueCheck")}

        <SectionRow title="Step 8: Costs" />
        {row("Ad Spend (from Step 5)", "$", "adSpend", "currency")}
        {input("Low-Ticket Commission", "%", "ltCommissionRate", 0, 100, 0.5, { percent: true })}
        {input("High-Ticket Commission", "%", "htCommissionRate", 0, 100, 0.5, { percent: true })}
        {row("Total Commission", "$", "totalCommission", "currency")}
        {input("Rep Base Salary (Per Rep Per Month)", "$", "repBaseSalary", 0, 20000, 100)}
        {row("Total Rep Base Salary", "$", "totalRepBaseSalary", "currency")}
        {input("Delivery Cost Per Low-Ticket Sale", "$", "ltDeliveryCost", 0, 2000, 5)}
        {input("Delivery Cost Per High-Ticket Sale", "$", "htDeliveryCost", 0, 10000, 25)}
        {row("Total Delivery Cost", "$", "totalDeliveryCost", "currency")}
        {input("Fixed Monthly Expenses", "$", "fixedMonthlyExpenses", 0, 100000, 100)}
        {row("Total Costs", "$", "totalCosts", "currency", true)}

        <SectionRow title="Step 9: Profit & Self-Liquidation" />
        {row("Net Profit", "$", "netProfit", "currency", true)}
        {row("ROAS", "x", "roas", "ratio", true)}
        {row("Profit Margin", "%", "profitMargin", "percent", true)}
        {check("Self-Liquidation Check", "YES / NO", "YES", "selfLiquidationCheck")}
        {row("LT Revenue / Ad Spend Ratio", "x", "ltRevenueToAdSpend", "ratio")}
        {row("Blended CPA", "$", "blendedCpa", "currency")}
        {row("HT Deal Rate (% of LT Buyers)", "%", "htDealRate", "percent")}

        <SectionRow title="Step 10: Break-Even Sensitivity" />
        {row("Minimum Activation Rate", "%", "minimumActivationRate", "percent")}
        {row("Minimum Upsell Close Rate", "%", "minimumUpsellCloseRate", "percent")}
        {row("Minimum High-Ticket AOV", "$", "minimumHtAov", "currency")}
        {row("Minimum Attribution Rate", "%", "minimumAttributionRate", "percent")}
      </ModelTable>
    </div>
  );
}
