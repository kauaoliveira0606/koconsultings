"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  applyVslDownside,
  computeVslFunnel,
  type VslFunnelInputs,
} from "@/lib/models/vsl-funnel-model";
import { usePersistedState } from "@/lib/use-persisted-state";
import { ModelTable, SectionRow, ToggleButtons, useModelRows } from "./model-table";

const DEFAULT_INPUTS: VslFunnelInputs = {
  revenueTarget: 100000,
  htAov: 5000,
  closeRate: 0.25,
  twoCallClose: false,
  secondCallBookingRate: 0.7,
  secondCallShowRate: 0.8,
  showRate: 0.7,
  applicationToScheduleRate: 0.6,
  vslToApplicationRate: 0.05,
  vslPlayRate: 0.4,
  cpc: 2,
  callsPerCloserPerDay: 4,
  workingDaysPerMonth: 22,
  salesCommissionRate: 0.1,
  closerBaseSalary: 0,
  deliveryCostPerSale: 0,
  fixedMonthlyExpenses: 0,
};

export function VslFunnelModel() {
  const [inputs, setInputs] = usePersistedState<VslFunnelInputs>(
    `vsl-funnel-model-v1:${usePathname()}:inputs`,
    DEFAULT_INPUTS
  );

  const d15 = useMemo(() => applyVslDownside(inputs, 0.85), [inputs]);
  const d30 = useMemo(() => applyVslDownside(inputs, 0.7), [inputs]);
  const results = useMemo(
    () => ({
      base: computeVslFunnel(inputs),
      d15: computeVslFunnel(d15),
      d30: computeVslFunnel(d30),
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
      <h2 className="mb-1 text-lg font-bold">High-Ticket VSL Call Funnel</h2>
      <p className="mb-4 text-sm text-black/60">
        VSL → Application → Scheduled Call → Show Up → Close. All numbers per month. Set a revenue
        target and your funnel rates — this works backward to the calls, applications, visitors,
        ad spend and closers it takes, then the costs, profit and break-evens. The -15% / -30%
        columns show what happens if every conversion rate drops that much and Cost Per Click
        rises by the same amount.
      </p>

      <ToggleButtons
        value={inputs.twoCallClose ? "two" : "one"}
        options={[
          { id: "one", label: "One-Call Close" },
          { id: "two", label: "Two-Call Close" },
        ]}
        onChange={(id) => setInputs((prev) => ({ ...prev, twoCallClose: id === "two" }))}
      />

      <ModelTable>
        <SectionRow title="Step 1: Revenue Target → Deals Required" />
        {input("Revenue Target", "$", "revenueTarget", 0, 1000000, 1000)}
        {input("High-Ticket AOV", "$", "htAov", 0, 50000, 100)}
        {row("Deals Required", "#", "dealsRequired", "number", true)}

        <SectionRow title="Step 2: Deals Required → Shown Calls Required" />
        {input("Close Rate", "%", "closeRate", 0, 100, 1, rate)}
        {row("Shown Calls Required", "#", "shownCallsRequired", "number", true)}

        {inputs.twoCallClose ? (
          <>
            <SectionRow title="Two-Call Close Variant (Between Steps 2 and 3)" />
            {input("Second-Call Booking Rate", "%", "secondCallBookingRate", 0, 100, 1, rate)}
            {input("Second-Call Show Rate", "%", "secondCallShowRate", 0, 100, 1, rate)}
            {row("Adjusted Shown Calls Required", "#", "adjustedShownCallsRequired", "number")}
            {row("Adjusted First-Call Shown Required", "#", "adjustedFirstCallShownRequired", "number", true)}
          </>
        ) : null}

        <SectionRow title="Step 3: Shown Calls → Scheduled Calls Required" />
        {input("Show Rate", "%", "showRate", 0, 100, 1, rate)}
        {row("Scheduled Calls Required", "#", "scheduledCallsRequired", "number", true)}

        <SectionRow title="Step 4: Scheduled Calls → Applications Required" />
        {input("Application-to-Schedule Rate", "%", "applicationToScheduleRate", 0, 100, 1, rate)}
        {row("Applications Required", "#", "applicationsRequired", "number", true)}

        <SectionRow title="Step 5: Applications → VSL Viewers Required" />
        {input("VSL-to-Application Rate", "%", "vslToApplicationRate", 0, 100, 0.5, rate)}
        {row("VSL Viewers Required", "#", "vslViewersRequired", "number", true)}

        <SectionRow title="Step 6: VSL Viewers → Page Visitors Required" />
        {input("VSL Play Rate", "%", "vslPlayRate", 0, 100, 1, rate)}
        {row("Page Visitors Required", "#", "pageVisitorsRequired", "number", true)}

        <SectionRow title="Step 7: Page Visitors → Ad Spend Required" />
        {input("Cost Per Click (CPC)", "$", "cpc", 0, 50, 0.1, { scenario: true })}
        {row("Ad Spend Required", "$", "adSpendRequired", "currency", true)}

        <SectionRow title="Step 8: Deals Required → Closers Required" />
        {input("Calls Per Closer Per Day", "#", "callsPerCloserPerDay", 0, 30, 1)}
        {input("Working Days Per Month", "#", "workingDaysPerMonth", 1, 31, 1)}
        {row("Deals Per Closer Per Month", "#", "dealsPerCloserPerMonth", "number")}
        {row("Closers Required (Exact)", "#", "closersRequiredExact", "number")}
        {row("Closers Required (Rounded Up)", "#", "closersRequired", "number", true)}

        <SectionRow title="Step 9: Validate Capacity" />
        {row("Total Call Capacity", "#", "totalCallCapacity", "number")}
        {check("Capacity Check", "OK / UNDERSTAFFED", "OK", "capacityCheck")}

        <SectionRow title="Step 10: Costs" />
        {row("Ad Spend (from Step 7)", "$", "adSpend", "currency")}
        {input("Sales Commission", "%", "salesCommissionRate", 0, 100, 0.5, { percent: true })}
        {row("Sales Commission", "$", "salesCommission", "currency")}
        {input("Closer Base Salary (Per Closer Per Month)", "$", "closerBaseSalary", 0, 20000, 100)}
        {row("Total Closer Base Salary", "$", "totalCloserBaseSalary", "currency")}
        {input("Delivery Cost Per Sale", "$", "deliveryCostPerSale", 0, 10000, 25)}
        {row("Total Delivery Cost", "$", "totalDeliveryCost", "currency")}
        {input("Fixed Monthly Expenses", "$", "fixedMonthlyExpenses", 0, 100000, 100)}
        {row("Total Costs", "$", "totalCosts", "currency", true)}

        <SectionRow title="Step 11: Profit" />
        {row("Gross Revenue", "$", "grossRevenue", "currency")}
        {row("Net Profit", "$", "netProfit", "currency", true)}
        {row("ROAS", "x", "roas", "ratio", true)}
        {row("Profit Margin", "%", "profitMargin", "percent", true)}
        {row("Cost Per Scheduled Call", "$", "costPerScheduledCall", "currency")}
        {row("Cost Per Shown Call", "$", "costPerShownCall", "currency")}
        {row("CPA", "$", "cpa", "currency")}
        {row("Revenue Per Closer Per Month", "$", "revenuePerCloserPerMonth", "currency")}

        <SectionRow title="Step 12: Break-Even Sensitivity" />
        {row("Max Tolerable CPC", "$", "maxTolerableCpc", "currency")}
        {row("Minimum Close Rate", "%", "minimumCloseRate", "percent")}
        {row("Minimum Show Rate", "%", "minimumShowRate", "percent")}
        {row("Minimum AOV", "$", "minimumAov", "currency")}
      </ModelTable>
    </div>
  );
}
