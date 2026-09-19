"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  applyWebinarDownside,
  computeWebinarFunnel,
  type WebinarFunnelInputs,
} from "@/lib/models/webinar-funnel-model";
import { usePersistedState } from "@/lib/use-persisted-state";
import { ModelTable, SectionRow, ToggleButtons, useModelRows } from "./model-table";

const DEFAULT_INPUTS: WebinarFunnelInputs = {
  revenueTarget: 100000,
  htAov: 5000,
  closeRate: 0.1,
  showRate: 0.3,
  costPerRegistration: 8,
  vipPrice: 97,
  vipTakeRate: 0.08,
  callBased: true,
  callsPerCloserPerDay: 6,
  workingDaysPerMonth: 22,
  webinarCloseRate: 0.25,
  bookingRate: 0.15,
  callShowRate: 0.7,
  salesCommissionRate: 0.1,
  vipDeliveryCost: 0,
  closerBaseSalary: 0,
  htDeliveryCost: 0,
  platformCosts: 0,
  fixedMonthlyExpenses: 0,
};

export function WebinarFunnelModel() {
  const [inputs, setInputs] = usePersistedState<WebinarFunnelInputs>(
    `webinar-funnel-model-v1:${usePathname()}:inputs`,
    DEFAULT_INPUTS
  );

  const d15 = useMemo(() => applyWebinarDownside(inputs, 0.85), [inputs]);
  const d30 = useMemo(() => applyWebinarDownside(inputs, 0.7), [inputs]);
  const results = useMemo(
    () => ({
      base: computeWebinarFunnel(inputs),
      d15: computeWebinarFunnel(d15),
      d30: computeWebinarFunnel(d30),
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
      <h2 className="mb-1 text-lg font-bold">Webinar Funnel with VIP Ticket Order Bump</h2>
      <p className="mb-4 text-sm text-black/60">
        Ad → Registration Page (with VIP order bump) → Confirmation → Webinar Show Up → Pitch →
        Close. The VIP ticket is a paid order bump on the registration page that adds immediate
        revenue and pre-qualifies buyers. All numbers per month. The -15% / -30% columns show what
        happens if every conversion rate drops that much and Cost Per Registration rises by the
        same amount.
      </p>

      <ToggleButtons
        value={inputs.callBased ? "calls" : "direct"}
        options={[
          { id: "calls", label: "Webinar Books Calls" },
          { id: "direct", label: "Direct-to-Checkout" },
        ]}
        onChange={(id) => setInputs((prev) => ({ ...prev, callBased: id === "calls" }))}
      />

      <ModelTable>
        <SectionRow title="Step 1: Revenue Target → Deals Required" />
        {input("Revenue Target", "$", "revenueTarget", 0, 1000000, 1000)}
        {input("High-Ticket AOV", "$", "htAov", 0, 50000, 100)}
        {row("High-Ticket Deals Required", "#", "htDealsRequired", "number", true)}

        <SectionRow title="Step 2: Deals Required → Attendees Required" />
        {input("Close Rate (From Attendees)", "%", "closeRate", 0, 100, 1, rate)}
        {row("Attendees Required", "#", "attendeesRequired", "number", true)}

        <SectionRow title="Step 3: Attendees → Registrations Required" />
        {input("Show Rate (Registrants Who Attend Live)", "%", "showRate", 0, 100, 1, rate)}
        {row("Registrations Required", "#", "registrationsRequired", "number", true)}

        <SectionRow title="Step 4: Registrations → Ad Spend Required" />
        {input("Cost Per Registration (CPR)", "$", "costPerRegistration", 0, 100, 0.5, { scenario: true })}
        {row("Ad Spend Required", "$", "adSpendRequired", "currency", true)}

        <SectionRow title="Step 5: VIP Order Bump Revenue" />
        {input("VIP Ticket Price", "$", "vipPrice", 0, 2000, 1)}
        {input("VIP Take Rate (Registrants Who Add the VIP Ticket)", "%", "vipTakeRate", 0, 100, 0.5, rate)}
        {row("VIP Buyers", "#", "vipBuyers", "number")}
        {row("VIP Revenue", "$", "vipRevenue", "currency", true)}

        <SectionRow title="Step 6: Total Revenue" />
        {row("High-Ticket Revenue", "$", "htRevenue", "currency")}
        {row("Total Gross Revenue", "$", "totalGrossRevenue", "currency", true)}
        {check("Revenue Check", "OK / SHORTFALL", "OK", "revenueCheck")}

        <SectionRow
          title={
            inputs.callBased
              ? "Step 7: Deals Required → Closers Required"
              : "Step 7: Deals Required → Closers Required (Skipped: Direct-to-Checkout)"
          }
        />
        {inputs.callBased ? (
          <>
            {input("Calls Per Closer Per Day", "#", "callsPerCloserPerDay", 0, 30, 1)}
            {input("Working Days Per Month", "#", "workingDaysPerMonth", 1, 31, 1)}
            {input("Webinar Close Rate (From Booked Calls)", "%", "webinarCloseRate", 0, 100, 1, rate)}
            {input("Booking Rate (Attendees Who Book a Call)", "%", "bookingRate", 0, 100, 1, rate)}
            {input("Call Show Rate", "%", "callShowRate", 0, 100, 1, rate)}
            {row("Calls Per Webinar (Attendees × Booking Rate)", "#", "callsPerWebinar", "number")}
            {row("Deals Per Closer Per Month", "#", "dealsPerCloserPerMonth", "number")}
            {row("Closers Required (Exact)", "#", "closersRequiredExact", "number")}
          </>
        ) : null}
        {row("Closers Required (Rounded Up)", "#", "closersRequired", "number", true)}

        <SectionRow title="Step 8: Costs" />
        {row("Ad Spend (from Step 4)", "$", "adSpend", "currency")}
        {input("Sales Commission", "%", "salesCommissionRate", 0, 100, 0.5, { percent: true })}
        {row("Sales Commission", "$", "salesCommission", "currency")}
        {input("VIP Delivery Cost Per VIP Buyer", "$", "vipDeliveryCost", 0, 1000, 1)}
        {row("Total VIP Delivery Cost", "$", "totalVipDeliveryCost", "currency")}
        {input("Closer Base Salary (Per Closer Per Month)", "$", "closerBaseSalary", 0, 20000, 100)}
        {row("Total Closer Base Salary", "$", "totalCloserBaseSalary", "currency")}
        {input("Delivery Cost Per High-Ticket Sale", "$", "htDeliveryCost", 0, 10000, 25)}
        {row("Total Delivery Cost", "$", "totalDeliveryCost", "currency")}
        {input("Webinar Platform / Software Costs", "$", "platformCosts", 0, 20000, 50)}
        {input("Fixed Monthly Expenses", "$", "fixedMonthlyExpenses", 0, 100000, 100)}
        {row("Total Costs", "$", "totalCosts", "currency", true)}

        <SectionRow title="Step 9: Profit" />
        {row("Net Profit", "$", "netProfit", "currency", true)}
        {row("ROAS", "x", "roas", "ratio", true)}
        {row("Profit Margin", "%", "profitMargin", "percent", true)}
        {row("Cost Per Attendee", "$", "costPerAttendee", "currency")}
        {row("Cost Per Registration (from Step 4)", "$", "costPerRegistration", "currency")}
        {row("CPA (High-Ticket)", "$", "cpa", "currency")}
        {row("VIP Revenue / Ad Spend Ratio", "x", "vipRevenueToAdSpend", "ratio")}
        {check("Self-Liquidation Check", "YES / NO", "YES", "selfLiquidationCheck")}

        <SectionRow title="Step 10: Break-Even Sensitivity" />
        {row("Max Tolerable CPR", "$", "maxTolerableCpr", "currency")}
        {row("Minimum Show Rate", "%", "minimumShowRate", "percent")}
        {row("Minimum Close Rate", "%", "minimumCloseRate", "percent")}
        {row("Minimum VIP Take Rate", "%", "minimumVipTakeRate", "percent")}
        {row("Minimum High-Ticket AOV", "$", "minimumHtAov", "currency")}
      </ModelTable>
    </div>
  );
}
