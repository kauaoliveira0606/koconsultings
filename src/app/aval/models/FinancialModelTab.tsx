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

function CheckRow({
  label,
  unit,
  good,
  base,
  d15,
  d30,
}: {
  label: string;
  unit: string;
  good: string;
  base: string;
  d15: string;
  d30: string;
}) {
  const cell = (value: string) => (
    <td
      className={`px-4 py-3 text-right font-semibold ${
        value === good ? "text-emerald-700" : "text-red-700"
      }`}
    >
      {value}
    </td>
  );
  return (
    <tr className="border-b border-black/5">
      <td className="px-4 py-3">{label}</td>
      <td className="px-4 py-3 text-black/50">{unit}</td>
      <td className="px-4 py-3" />
      {cell(base)}
      {cell(d15)}
      {cell(d30)}
    </tr>
  );
}

export function FinancialModelTab() {
  // "-v4": the model was rebuilt (low-ticket to high-ticket ascension), so numbers saved
  // by earlier versions must not carry over.
  const [inputs, setInputs] = usePersistedState<FinancialModelInputs>(
    `financial-model-v4:${usePathname()}:inputs`,
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

  // A percent input row whose Base / -15% / -30% columns show the degraded rate.
  const rateRow = (
    label: string,
    key:
      | "upsellCloseRate"
      | "upsellContactRate"
      | "activationRate"
      | "attributionRate"
      | "closeRate"
      | "connectRate"
  ) => (
    <SliderRow
      label={label}
      unit="%"
      value={inputs[key] * 100}
      min={0}
      max={100}
      step={1}
      onChange={(v) => set({ [key]: v / 100 })}
      format="percent"
      scenarioValues={{ base: inputs[key], d15: d15Inputs[key], d30: d30Inputs[key] }}
    />
  );

  // A plain (non-degraded) input row.
  const inputRow = (
    label: string,
    unit: string,
    key: Exclude<
      keyof FinancialModelInputs,
      | "upsellCloseRate"
      | "upsellContactRate"
      | "activationRate"
      | "attributionRate"
      | "closeRate"
      | "connectRate"
      | "costPerLead"
      | "ltCommissionRate"
      | "htCommissionRate"
    >,
    min: number,
    max: number,
    step: number
  ) => (
    <SliderRow
      label={label}
      unit={unit}
      value={inputs[key]}
      min={min}
      max={max}
      step={step}
      onChange={(v) => set({ [key]: v })}
    />
  );

  // A computed row: pulls the same key from all three scenarios.
  const row = (
    label: string,
    unit: string,
    key: Exclude<keyof typeof r.base, "revenueCheck" | "selfLiquidationCheck">,
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
      <h2 className="mb-1 text-lg font-bold">Low-Ticket to High-Ticket Ascension</h2>
      <p className="mb-4 text-sm text-black/60">
        All numbers per month. Set a total revenue target and your funnel rates — this works
        backward to the high-ticket and low-ticket deals, calls, leads, ad spend and reps it takes,
        then the costs, profit and break-evens. Drag a slider or type a number directly. The -15% /
        -30% columns show what happens if every conversion rate drops that much and Cost Per Lead
        rises by the same amount.
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
            {inputRow("Total Revenue Target", "$", "revenueTarget", 0, 1000000, 1000)}
            {inputRow("High-Ticket AOV", "$", "htAov", 0, 50000, 100)}
            {row("High-Ticket Deals Required", "#", "htDealsRequired", "number", true)}

            <SectionRow title="Step 2: High-Ticket Deals → Low-Ticket Deals Required" />
            {rateRow("Upsell Close Rate", "upsellCloseRate")}
            {rateRow("Upsell Contact Rate", "upsellContactRate")}
            {rateRow("Activation Rate", "activationRate")}
            {rateRow("Attribution Rate (Share of Deals We Get Paid On)", "attributionRate")}
            {row("Low-Ticket Deals Required", "#", "ltDealsRequired", "number", true)}

            <SectionRow title="Step 3: Low-Ticket Deals → Connected Calls Required" />
            {rateRow("Close Rate (First Call)", "closeRate")}
            {row("Connected Calls Required", "#", "connectedCallsRequired", "number", true)}

            <SectionRow title="Step 4: Connected Calls → Leads Required" />
            {rateRow("Connect Rate (Share of Leads Reached by Phone)", "connectRate")}
            {row("Leads Required", "#", "leadsRequired", "number", true)}

            <SectionRow title="Step 5: Leads Required → Ad Spend Required" />
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

            <SectionRow title="Step 6: Deals Required → Reps Required" />
            {inputRow("Contacts Per Rep Per Day", "#", "contactsPerRepPerDay", 0, 200, 1)}
            {inputRow("Working Days Per Month", "#", "workingDaysPerMonth", 1, 31, 1)}
            {row("Front-End Deals Per Rep Per Month", "#", "frontEndDealsPerRepPerMonth", "number")}
            {row("Front-End Reps Required", "#", "frontEndRepsRequired", "number", true)}
            {inputRow("Upsell Calls Per Rep Per Day", "#", "upsellCallsPerRepPerDay", 0, 100, 1)}
            {row("Upsell Deals Per Rep Per Month", "#", "upsellDealsPerRepPerMonth", "number")}
            {row("Backend Reps Required", "#", "backendRepsRequired", "number", true)}

            <SectionRow title="Step 7: Revenue Breakdown" />
            {inputRow("Low-Ticket AOV", "$", "ltAov", 0, 5000, 10)}
            {row("Low-Ticket Revenue (Attributed)", "$", "ltRevenue", "currency")}
            {row("High-Ticket Revenue", "$", "htRevenue", "currency")}
            {row("Total Gross Revenue", "$", "totalGrossRevenue", "currency", true)}
            <CheckRow label="Revenue Check" unit="OK / SHORTFALL" good="OK" base={r.base.revenueCheck} d15={r.d15.revenueCheck} d30={r.d30.revenueCheck} />

            <SectionRow title="Step 8: Costs" />
            {row("Ad Spend (from Step 5)", "$", "adSpend", "currency")}
            <SliderRow
              label="Low-Ticket Commission"
              unit="%"
              value={inputs.ltCommissionRate * 100}
              min={0}
              max={100}
              step={0.5}
              onChange={(v) => set({ ltCommissionRate: v / 100 })}
            />
            <SliderRow
              label="High-Ticket Commission"
              unit="%"
              value={inputs.htCommissionRate * 100}
              min={0}
              max={100}
              step={0.5}
              onChange={(v) => set({ htCommissionRate: v / 100 })}
            />
            {row("Total Commission", "$", "totalCommission", "currency")}
            {inputRow("Rep Base Salary (Per Rep Per Month)", "$", "repBaseSalary", 0, 20000, 100)}
            {row("Total Rep Base Salary", "$", "totalRepBaseSalary", "currency")}
            {inputRow("Delivery Cost Per Low-Ticket Sale", "$", "ltDeliveryCost", 0, 2000, 5)}
            {inputRow("Delivery Cost Per High-Ticket Sale", "$", "htDeliveryCost", 0, 10000, 25)}
            {row("Total Delivery Cost", "$", "totalDeliveryCost", "currency")}
            {inputRow("Fixed Monthly Expenses", "$", "fixedMonthlyExpenses", 0, 100000, 100)}
            {row("Total Costs", "$", "totalCosts", "currency", true)}

            <SectionRow title="Step 9: Profit & Self-Liquidation" />
            {row("Net Profit", "$", "netProfit", "currency", true)}
            {row("ROAS", "x", "roas", "ratio", true)}
            {row("Profit Margin", "%", "profitMargin", "percent", true)}
            <CheckRow label="Self-Liquidation Check" unit="YES / NO" good="YES" base={r.base.selfLiquidationCheck} d15={r.d15.selfLiquidationCheck} d30={r.d30.selfLiquidationCheck} />
            {row("LT Revenue / Ad Spend Ratio", "x", "ltRevenueToAdSpend", "ratio")}
            {row("Blended CPA", "$", "blendedCpa", "currency")}
            {row("HT Deal Rate (% of LT Buyers)", "%", "htDealRate", "percent")}

            <SectionRow title="Step 10: Break-Even Sensitivity" />
            {row("Minimum Activation Rate", "%", "minimumActivationRate", "percent")}
            {row("Minimum Upsell Close Rate", "%", "minimumUpsellCloseRate", "percent")}
            {row("Minimum High-Ticket AOV", "$", "minimumHtAov", "currency")}
            {row("Minimum Attribution Rate", "%", "minimumAttributionRate", "percent")}
          </tbody>
        </table>
      </div>
    </div>
  );
}
