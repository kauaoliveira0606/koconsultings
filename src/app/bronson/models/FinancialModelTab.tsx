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
  monthlyAdSpend: 30000,
  costPerLead: 50,
  reps: 4,
  contactsPerRepPerDay: 30,
  workingDaysPerMonth: 22,
  connectRate: 0.4,
  closeRate: 0.2,
  attributionRate: 0.85,
  aov: 300,
  salesCommissionRate: 0.1,
  repBaseSalary: 0,
  deliveryCostPerDeal: 0,
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

export function FinancialModelTab() {
  // "-v2": the model was rebuilt (monthly, with rep capacity and costs), so numbers
  // saved by the old daily model must not carry over.
  const [inputs, setInputs] = usePersistedState<FinancialModelInputs>(
    `financial-model-v2:${usePathname()}:inputs`,
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
    key: keyof typeof r.base,
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
        Low-ticket model, all numbers per month. Drag a slider or type a number directly and
        everything downstream calculates automatically. The -15% / -30% columns show what happens
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
            <SectionRow title="Ad Spend & Lead Generation" />
            <SliderRow
              label="Monthly Ad Spend"
              unit="$"
              value={inputs.monthlyAdSpend}
              min={0}
              max={500000}
              step={500}
              onChange={(v) => set({ monthlyAdSpend: v })}
            />
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
            {row("Leads Generated", "#", "leadsGenerated", "number")}

            <SectionRow title="Rep Capacity & Connect" />
            <SliderRow
              label="Full-Cycle Reps"
              unit="#"
              value={inputs.reps}
              min={0}
              max={50}
              step={1}
              onChange={(v) => set({ reps: v })}
            />
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
            {row("Total Connected Call Capacity", "#", "totalConnectedCallCapacity", "number")}
            <SliderRow
              label="Connect Rate"
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
            {row("Actual Connected Calls", "#", "actualConnectedCalls", "number")}

            <SectionRow title="Conversion" />
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
            {row("Deals Closed", "#", "dealsClosed", "number")}
            <SliderRow
              label="Attribution Rate (Share of Deals We Get Paid On)"
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
            {row("Attributed Deals (Paid)", "#", "attributedDeals", "number")}
            <SliderRow
              label="Low-Ticket AOV"
              unit="$"
              value={inputs.aov}
              min={0}
              max={5000}
              step={10}
              onChange={(v) => set({ aov: v })}
            />

            <SectionRow title="Revenue" />
            {row("Gross Revenue (Attributed)", "$", "grossRevenue", "currency", true)}
            {row("Lost Revenue (Unattributed)", "$", "lostRevenue", "currency")}

            <SectionRow title="Costs" />
            {row("Ad Spend", "$", "adSpend", "currency")}
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
              label="Rep Base Salary (Per Rep)"
              unit="$"
              value={inputs.repBaseSalary}
              min={0}
              max={20000}
              step={100}
              onChange={(v) => set({ repBaseSalary: v })}
            />
            {row("Total Rep Base Salary", "$", "totalRepBaseSalary", "currency")}
            <SliderRow
              label="Delivery Cost (Per Paid Deal)"
              unit="$"
              value={inputs.deliveryCostPerDeal}
              min={0}
              max={2000}
              step={5}
              onChange={(v) => set({ deliveryCostPerDeal: v })}
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

            <SectionRow title="Profit & ROAS" />
            {row("Net Profit", "$", "netProfit", "currency", true)}
            {row("ROAS", "x", "roas", "ratio", true)}
            {row("Profit Margin", "%", "profitMargin", "percent", true)}
            {row("Cost Per Acquisition (CPA)", "$", "cpa", "currency")}
            {row("Revenue Per Rep Per Month", "$", "revenuePerRep", "currency")}
            {row("Deals Per Rep Per Month", "#", "dealsPerRep", "number")}

            <SectionRow title="Break-Even Sensitivity" />
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
