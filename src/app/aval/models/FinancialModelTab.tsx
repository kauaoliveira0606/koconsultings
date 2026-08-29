"use client";

import { useMemo, useState } from "react";
import {
  applyDownside,
  computeFinancialModel,
  projectPeriod,
  WEEKLY_MULTIPLIER,
  MONTHLY_MULTIPLIER,
  type FinancialModelInputs,
} from "@/lib/models/financial-model";
import { formatStatValue, type StatFormat } from "@/lib/format";

const DEFAULT_INPUTS: FinancialModelInputs = {
  adSpend: 5000,
  costPerLead: 50,
  connectionRate: 0.4,
  closeRate: 0.2,
  attributionRate: 0.85,
  avgCashPerSale: 300,
  includeHighTicket: false,
  ltToHtRate: 0.143,
  htAov: 5000,
};

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  scenarioValues,
  periodValues,
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
  periodValues?: { weekly: number; monthly: number };
  format?: StatFormat;
}) {
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3 font-medium">{label}</td>
      <td className="px-4 py-3 text-white/50">{unit}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-32 accent-emerald-500"
          />
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 rounded-md border border-white/10 bg-[#0A0E14] px-2 py-1 text-right text-white [color-scheme:dark]"
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
      <td className="px-4 py-3 text-right">
        {periodValues ? formatStatValue(periodValues.weekly, format) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        {periodValues ? formatStatValue(periodValues.monthly, format) : "—"}
      </td>
    </tr>
  );
}

function computedCell(value: number, format: StatFormat): string {
  return formatStatValue(value, format);
}

export function FinancialModelTab() {
  const [inputs, setInputs] = useState<FinancialModelInputs>(DEFAULT_INPUTS);

  const downside15Inputs = useMemo(() => applyDownside(inputs, 0.85), [inputs]);
  const downside30Inputs = useMemo(() => applyDownside(inputs, 0.7), [inputs]);

  const scenarios = useMemo(() => {
    const base = computeFinancialModel(inputs);
    const downside15 = computeFinancialModel(downside15Inputs);
    const downside30 = computeFinancialModel(downside30Inputs);
    return { base, downside15, downside30 };
  }, [inputs, downside15Inputs, downside30Inputs]);

  const set = (patch: Partial<FinancialModelInputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => set({ includeHighTicket: false })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            !inputs.includeHighTicket ? "bg-emerald-500 text-black" : "border border-white/10 bg-[#111826]"
          }`}
        >
          Low Ticket
        </button>
        <button
          type="button"
          onClick={() => set({ includeHighTicket: true })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            inputs.includeHighTicket ? "bg-emerald-500 text-black" : "border border-white/10 bg-[#111826]"
          }`}
        >
          Low Ticket → High Ticket
        </button>
      </div>

      <p className="mb-4 text-sm text-white/60">
        Drag a slider or type a number directly. Downstream numbers calculate automatically. The
        -15% / -30% columns show what happens if every conversion rate below drops that much.
        Weekly and Monthly are projections at today&apos;s current numbers.
      </p>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111826]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase text-white/50">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Your Numbers (Daily)</th>
              <th className="px-4 py-3 text-right text-emerald-600">Base Case</th>
              <th className="px-4 py-3 text-right text-amber-600">-15% Downside</th>
              <th className="px-4 py-3 text-right text-red-600">-30% Downside</th>
              <th className="px-4 py-3 text-right">Weekly Projection</th>
              <th className="px-4 py-3 text-right">Monthly Projection</th>
            </tr>
          </thead>
          <tbody>
            <SliderRow
              label="Ad Spend"
              unit="$"
              value={inputs.adSpend}
              min={0}
              max={50000}
              step={100}
              onChange={(v) => set({ adSpend: v })}
              format="currency"
              periodValues={{
                weekly: projectPeriod(inputs.adSpend, WEEKLY_MULTIPLIER),
                monthly: projectPeriod(inputs.adSpend, MONTHLY_MULTIPLIER),
              }}
            />
            <SliderRow
              label="Cost Per Lead"
              unit="$"
              value={inputs.costPerLead}
              min={1}
              max={500}
              step={1}
              onChange={(v) => set({ costPerLead: v })}
              format="currency"
              scenarioValues={{
                base: inputs.costPerLead,
                d15: downside15Inputs.costPerLead,
                d30: downside30Inputs.costPerLead,
              }}
            />
            <ComputedRow label="Opt-Ins" unit="#" base={scenarios.base.optIns} d15={scenarios.downside15.optIns} d30={scenarios.downside30.optIns} format="number" />
            <SliderRow
              label="Connection Rate"
              unit="%"
              value={inputs.connectionRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ connectionRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.connectionRate,
                d15: downside15Inputs.connectionRate,
                d30: downside30Inputs.connectionRate,
              }}
            />
            <ComputedRow label="Pickups" unit="#" base={scenarios.base.pickups} d15={scenarios.downside15.pickups} d30={scenarios.downside30.pickups} format="number" />
            <SliderRow
              label="Close Rate"
              unit="%"
              value={inputs.closeRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ closeRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.closeRate,
                d15: downside15Inputs.closeRate,
                d30: downside30Inputs.closeRate,
              }}
            />
            <ComputedRow label="Sales (Closed)" unit="#" base={scenarios.base.sales} d15={scenarios.downside15.sales} d30={scenarios.downside30.sales} format="number" />
            <SliderRow
              label="Attribution Rate"
              unit="%"
              value={inputs.attributionRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ attributionRate: v / 100 })}
              format="percent"
              scenarioValues={{
                base: inputs.attributionRate,
                d15: downside15Inputs.attributionRate,
                d30: downside30Inputs.attributionRate,
              }}
            />
            <ComputedRow label="Attributed Sales (Paid Out)" unit="#" base={scenarios.base.attributedSales} d15={scenarios.downside15.attributedSales} d30={scenarios.downside30.attributedSales} format="number" />
            <SliderRow
              label="Avg Cash Per Sale (Low Ticket AOV)"
              unit="$"
              value={inputs.avgCashPerSale}
              min={0}
              max={2000}
              step={10}
              onChange={(v) => set({ avgCashPerSale: v })}
            />
            <ComputedRow
              label="Low Ticket Cash Collected"
              unit="$"
              base={scenarios.base.lowTicketCashCollected}
              d15={scenarios.downside15.lowTicketCashCollected}
              d30={scenarios.downside30.lowTicketCashCollected}
              weekly={projectPeriod(scenarios.base.lowTicketCashCollected, WEEKLY_MULTIPLIER)}
              monthly={projectPeriod(scenarios.base.lowTicketCashCollected, MONTHLY_MULTIPLIER)}
              format="currency"
            />

            {inputs.includeHighTicket ? (
              <>
                <SliderRow
                  label="Low Ticket → High Ticket Rate"
                  unit="%"
                  value={inputs.ltToHtRate * 100}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => set({ ltToHtRate: v / 100 })}
                  format="percent"
                  scenarioValues={{
                    base: inputs.ltToHtRate,
                    d15: downside15Inputs.ltToHtRate,
                    d30: downside30Inputs.ltToHtRate,
                  }}
                />
                <ComputedRow label="High Ticket Bookings" unit="#" base={scenarios.base.highTicketBookings} d15={scenarios.downside15.highTicketBookings} d30={scenarios.downside30.highTicketBookings} format="number" />
                <SliderRow
                  label="High Ticket AOV"
                  unit="$"
                  value={inputs.htAov}
                  min={0}
                  max={20000}
                  step={100}
                  onChange={(v) => set({ htAov: v })}
                />
                <ComputedRow
                  label="High Ticket Cash Collected"
                  unit="$"
                  base={scenarios.base.highTicketCashCollected}
                  d15={scenarios.downside15.highTicketCashCollected}
                  d30={scenarios.downside30.highTicketCashCollected}
                  weekly={projectPeriod(scenarios.base.highTicketCashCollected, WEEKLY_MULTIPLIER)}
                  monthly={projectPeriod(scenarios.base.highTicketCashCollected, MONTHLY_MULTIPLIER)}
                  format="currency"
                />
              </>
            ) : null}

            <ComputedRow
              label="Total Cash Collected"
              unit="$"
              base={scenarios.base.totalCashCollected}
              d15={scenarios.downside15.totalCashCollected}
              d30={scenarios.downside30.totalCashCollected}
              weekly={projectPeriod(scenarios.base.totalCashCollected, WEEKLY_MULTIPLIER)}
              monthly={projectPeriod(scenarios.base.totalCashCollected, MONTHLY_MULTIPLIER)}
              format="currency"
              highlight
            />
            <ComputedRow label="ROAS" unit="x" base={scenarios.base.roas} d15={scenarios.downside15.roas} d30={scenarios.downside30.roas} format="ratio" highlight />
            <ComputedRow
              label="Net Profit"
              unit="$"
              base={scenarios.base.netProfit}
              d15={scenarios.downside15.netProfit}
              d30={scenarios.downside30.netProfit}
              format="currency"
              highlight
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComputedRow({
  label,
  unit,
  base,
  d15,
  d30,
  weekly,
  monthly,
  format,
  highlight,
}: {
  label: string;
  unit: string;
  base: number;
  d15: number;
  d30: number;
  weekly?: number;
  monthly?: number;
  format: StatFormat;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-white/5 ${highlight ? "bg-blue-500/10 font-semibold" : ""}`}>
      <td className="px-4 py-3">{label}</td>
      <td className="px-4 py-3 text-white/50">{unit}</td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3 text-right text-emerald-700">{computedCell(base, format)}</td>
      <td className="px-4 py-3 text-right text-amber-700">{computedCell(d15, format)}</td>
      <td className="px-4 py-3 text-right text-red-700">{computedCell(d30, format)}</td>
      <td className="px-4 py-3 text-right">{weekly !== undefined ? computedCell(weekly, format) : "—"}</td>
      <td className="px-4 py-3 text-right">{monthly !== undefined ? computedCell(monthly, format) : "—"}</td>
    </tr>
  );
}
