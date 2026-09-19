"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  applyDownside,
  computeFinancialModel,
  type FinancialModelInputs,
} from "@/lib/models/financial-model";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { usePersistedState } from "@/lib/use-persisted-state";

const DEFAULT_INPUTS: FinancialModelInputs = {
  revenueTarget: 100000,
  aov: 500,
  closeRate: 0.2,
  attributionRate: 0.85,
  connectRate: 0.55,
  costPerLead: 10,
  contactsPerRepPerDay: 30,
  workingDaysPerMonth: 22,
  salesCommissionRate: 0.1,
  repBaseSalary: 0,
  deliveryCostPerSale: 0,
  fixedMonthlyExpenses: 0,
};

const COLUMN_COUNT = 6;

function SectionRow({ title }: { title: string }) {
  return (
    <tr className="border-b border-black/10 bg-black/[0.03]">
      <td colSpan={COLUMN_COUNT} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-black/60">
        {title}
      </td>
    </tr>
  );
}

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  scenarioValues,
  format = "number",
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  scenarioValues?: { base: number; d15: number; d30: number };
  format?: StatFormat;
}) {
  return (
    <tr className="border-b border-black/5">
      <td className="px-4 py-3 font-medium">{label}</td>
      <td className="px-4 py-3 text-black/50">{unit}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-32"
          />
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 rounded-md border border-black/10 px-2 py-1 text-right"
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right text-emerald-700">
        {scenarioValues ? formatStatValue(scenarioValues.base, format) : "—"}
      </td>
      <td className="px-4 py-3 text-right text-amber-700">
        {scenarioValues ? formatStatValue(scenarioValues.d15, format) : "—"}
      </td>
      <td className="px-4 py-3 text-right text-red-700">
        {scenarioValues ? formatStatValue(scenarioValues.d30, format) : "—"}
      </td>
    </tr>
  );
}

function ComputedRow({
  label,
  unit,
  base,
  d15,
  d30,
  format,
  highlight,
}: {
  label: string;
  unit: string;
  base: number;
  d15: number;
  d30: number;
  format: StatFormat;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-black/5 ${highlight ? "bg-blue-50 font-semibold" : ""}`}>
      <td className="px-4 py-3">{label}</td>
      <td className="px-4 py-3 text-black/50">{unit}</td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3 text-right text-emerald-700">{formatStatValue(base, format)}</td>
      <td className="px-4 py-3 text-right text-amber-700">{formatStatValue(d15, format)}</td>
      <td className="px-4 py-3 text-right text-red-700">{formatStatValue(d30, format)}</td>
    </tr>
  );
}

function CapacityCheckRow({ base, d15, d30 }: { base: string; d15: string; d30: string }) {
  const cell = (value: string) => (
    <td
      className={`px-4 py-3 text-right font-semibold ${
        value === "OK" ? "text-emerald-700" : "text-red-700"
      }`}
    >
      {value}
    </td>
  );
  return (
    <tr className="border-b border-black/5">
      <td className="px-4 py-3">Capacity Check</td>
      <td className="px-4 py-3 text-black/50">OK / UNDERSTAFFED</td>
      <td className="px-4 py-3" />
      {cell(base)}
      {cell(d15)}
      {cell(d30)}
    </tr>
  );
}

export function FinancialModelTab() {
  // "-v3": the model was rebuilt (revenue target drives everything), so numbers saved
  // by earlier versions must not carry over.
  const [inputs, setInputs] = usePersistedState<FinancialModelInputs>(
    `financial-model-v3:${usePathname()}:inputs`,
    DEFAULT_INPUTS
  );

  const d15Inputs = useMemo(() => applyDownside(inputs, 0.85), [inputs]);
  const d30Inputs = useMemo(() => applyDownside(inputs, 0.7), [inputs]);

  const r = useMemo(
    () => ({
      base: computeFinancialModel(inputs),
      d15: computeFinancialModel(d15Inputs),
      d30: computeFinancialModel(d30Inputs),
    }),
    [inputs, d15Inputs, d30Inputs]
  );

  const set = (patch: Partial<FinancialModelInputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  // A computed row: pulls the same key from all three scenarios.
  const row = (
    label: string,
    unit: string,
    key: Exclude<keyof typeof r.base, "capacityCheck">,
    format: StatFormat,
    highlight?: boolean
  ) => (
    <ComputedRow
      label={label}
      unit={unit}
      base={r.base[key]}
      d15={r.d15[key]}
      d30={r.d30[key]}
      format={format}
      highlight={highlight}
    />
  );

  return (
    <div>
      <p className="mb-4 text-sm text-black/60">
        Low-ticket model, all numbers per month. Set a revenue target and your funnel rates — this
        works backward to the deals, calls, leads, ad spend and reps it takes, then the costs and
        profit. Drag a slider or type a number directly. The -15% / -30% columns show what happens
        if Connect Rate, Close Rate and Attribution Rate drop that much and Cost Per Lead rises by
        the same amount.
      </p>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase text-black/50">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Your Numbers (Monthly)</th>
              <th className="px-4 py-3 text-right text-emerald-600">Base Case</th>
              <th className="px-4 py-3 text-right text-amber-600">-15% Downside</th>
              <th className="px-4 py-3 text-right text-red-600">-30% Downside</th>
            </tr>
          </thead>
          <tbody>
            <SectionRow title="Step 1: Revenue Target → Deals Required" />
            <SliderRow
              label="Revenue Target"
              unit="$"
              value={inputs.revenueTarget}
              min={0}
              max={1000000}
              step={1000}
              onChange={(v) => set({ revenueTarget: v })}
            />
            <SliderRow
              label="Low-Ticket AOV"
              unit="$"
              value={inputs.aov}
              min={0}
              max={5000}
              step={10}
              onChange={(v) => set({ aov: v })}
            />
            {row("Deals Required", "#", "dealsRequired", "number", true)}

            <SectionRow title="Step 2: Deals Required → Connected Calls Required" />
            <SliderRow
              label="Close Rate (First Call)"
              unit="%"
              value={inputs.closeRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ closeRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.closeRate,
                d15: d15Inputs.closeRate,
                d30: d30Inputs.closeRate,
              }}
            />
            <SliderRow
              label="Attribution Rate (Share of Closed Deals We Get Paid On)"
              unit="%"
              value={inputs.attributionRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ attributionRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.attributionRate,
                d15: d15Inputs.attributionRate,
                d30: d30Inputs.attributionRate,
              }}
            />
            {row("Connected Calls Required", "#", "connectedCallsRequired", "number", true)}

            <SectionRow title="Step 3: Connected Calls → Leads Required" />
            <SliderRow
              label="Connect Rate (Share of Leads Reached by Phone)"
              unit="%"
              value={inputs.connectRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ connectRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.connectRate,
                d15: d15Inputs.connectRate,
                d30: d30Inputs.connectRate,
              }}
            />
            {row("Leads Required", "#", "leadsRequired", "number", true)}

            <SectionRow title="Step 4: Leads Required → Ad Spend Required" />
            <SliderRow
              label="Cost Per Lead (CPL)"
              unit="$"
              value={inputs.costPerLead}
              min={1}
              max={500}
              step={1}
              onChange={(v) => set({ costPerLead: v })}
              format="currency"
              scenarioValues={{
                base: inputs.costPerLead,
                d15: d15Inputs.costPerLead,
                d30: d30Inputs.costPerLead,
              }}
            />
            {row("Ad Spend Required", "$", "adSpendRequired", "currency", true)}

            <SectionRow title="Step 5: Deals Required → Reps Required" />
            <SliderRow
              label="Contacts Per Rep Per Day"
              unit="#"
              value={inputs.contactsPerRepPerDay}
              min={0}
              max={200}
              step={1}
              onChange={(v) => set({ contactsPerRepPerDay: v })}
            />
            <SliderRow
              label="Working Days Per Month"
              unit="#"
              value={inputs.workingDaysPerMonth}
              min={1}
              max={31}
              step={1}
              onChange={(v) => set({ workingDaysPerMonth: v })}
            />
            {row("Deals Per Rep Per Month", "#", "dealsPerRepPerMonth", "number")}
            {row("Reps Required", "#", "repsRequired", "number", true)}
            {row("Reps Required (Rounded Up)", "#", "repsRequiredRoundUp", "number", true)}

            <SectionRow title="Step 6: Validate Capacity" />
            {row("Total Connected Call Capacity", "#", "totalConnectedCallCapacity", "number")}
            <CapacityCheckRow base={r.base.capacityCheck} d15={r.d15.capacityCheck} d30={r.d30.capacityCheck} />

            <SectionRow title="Step 7: Costs" />
            {row("Ad Spend (from Step 4)", "$", "adSpend", "currency")}
            <SliderRow
              label="Sales Commission"
              unit="%"
              value={inputs.salesCommissionRate * 100}
              min={0}
              max={100}
              step={0.5}
              onChange={(v) => set({ salesCommissionRate: v / 100 })}
            />
            {row("Sales Commission", "$", "salesCommission", "currency")}
            <SliderRow
              label="Rep Base Salary (Per Rep Per Month)"
              unit="$"
              value={inputs.repBaseSalary}
              min={0}
              max={20000}
              step={100}
              onChange={(v) => set({ repBaseSalary: v })}
            />
            {row("Total Rep Base Salary", "$", "totalRepBaseSalary", "currency")}
            <SliderRow
              label="Delivery Cost Per Sale"
              unit="$"
              value={inputs.deliveryCostPerSale}
              min={0}
              max={2000}
              step={5}
              onChange={(v) => set({ deliveryCostPerSale: v })}
            />
            {row("Total Delivery Cost", "$", "totalDeliveryCost", "currency")}
            <SliderRow
              label="Fixed Monthly Expenses"
              unit="$"
              value={inputs.fixedMonthlyExpenses}
              min={0}
              max={100000}
              step={100}
              onChange={(v) => set({ fixedMonthlyExpenses: v })}
            />
            {row("Total Costs", "$", "totalCosts", "currency", true)}

            <SectionRow title="Step 8: Profit" />
            {row("Gross Revenue (Attributed)", "$", "grossRevenue", "currency")}
            {row("Net Profit", "$", "netProfit", "currency", true)}
            {row("ROAS", "x", "roas", "ratio", true)}
            {row("Profit Margin", "%", "profitMargin", "percent", true)}
            {row("CPA", "$", "cpa", "currency")}

            <SectionRow title="Step 9: Break-Even Sensitivity" />
            {row("Max Tolerable CPL", "$", "maxTolerableCpl", "currency")}
            {row("Minimum Close Rate", "%", "minimumCloseRate", "percent")}
            {row("Minimum Attribution Rate", "%", "minimumAttributionRate", "percent")}
            {row("Minimum AOV", "$", "minimumAov", "currency")}
          </tbody>
        </table>
      </div>
    </div>
  );
}
