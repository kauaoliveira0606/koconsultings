"use client";

import { useMemo, useState } from "react";
import {
  applyCapacityDownside,
  computeCapacityModel,
  type CapacityModelInputs,
} from "@/lib/models/capacity-model";
import { formatStatValue } from "@/lib/format";

const DEFAULT_INPUTS: CapacityModelInputs = {
  revenueGoal: 50000,
  aov: 300,
  closeRate: 0.2,
  connectionRate: 0.4,
  workingDays: 22,
  dialsPerRepPerDay: 30,
};

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3 font-medium">{label}</td>
      <td className="px-4 py-3 text-white">{unit}</td>
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
    </tr>
  );
}

export function CapacityModelTab() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [inputs, setInputs] = useState<CapacityModelInputs>(DEFAULT_INPUTS);

  const scenarios = useMemo(() => {
    const base = computeCapacityModel(inputs);
    const d15 = computeCapacityModel(applyCapacityDownside(inputs, 0.85));
    const d30 = computeCapacityModel(applyCapacityDownside(inputs, 0.7));
    return { base, d15, d30 };
  }, [inputs]);

  const set = (patch: Partial<CapacityModelInputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPeriod("weekly")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "weekly" ? "bg-emerald-500 text-black" : "border border-white/10 bg-[#111826]"
          }`}
        >
          Weekly Goal
        </button>
        <button
          type="button"
          onClick={() => setPeriod("monthly")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "monthly" ? "bg-emerald-500 text-black" : "border border-white/10 bg-[#111826]"
          }`}
        >
          Monthly Goal
        </button>
      </div>

      <p className="mb-4 text-sm text-white">
        Set a revenue goal and your current funnel rates — this works backward to how many
        outbound dials that requires and how many reps it takes, given how many leads one dialer
        can realistically work in a day. -15% / -30% show what happens to headcount if Close Rate
        and Connection Rate both slip.
      </p>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111826]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase text-white">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Your Numbers</th>
              <th className="px-4 py-3 text-right text-emerald-600">Base Case</th>
              <th className="px-4 py-3 text-right text-amber-600">-15% Downside</th>
              <th className="px-4 py-3 text-right text-red-600">-30% Downside</th>
            </tr>
          </thead>
          <tbody>
            <SliderRow
              label={`Revenue Goal (${period === "weekly" ? "Weekly" : "Monthly"})`}
              unit="$"
              value={inputs.revenueGoal}
              min={0}
              max={500000}
              step={500}
              onChange={(v) => set({ revenueGoal: v })}
            />
            <SliderRow
              label="AOV"
              unit="$"
              value={inputs.aov}
              min={0}
              max={20000}
              step={10}
              onChange={(v) => set({ aov: v })}
            />
            <Row label="Sales Needed" base={scenarios.base.salesNeeded} d15={scenarios.d15.salesNeeded} d30={scenarios.d30.salesNeeded} />
            <SliderRow
              label="Close Rate"
              unit="%"
              value={inputs.closeRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ closeRate: v / 100 })}
            />
            <Row label="Pickups Needed" base={scenarios.base.pickupsNeeded} d15={scenarios.d15.pickupsNeeded} d30={scenarios.d30.pickupsNeeded} />
            <SliderRow
              label="Connection Rate"
              unit="%"
              value={inputs.connectionRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ connectionRate: v / 100 })}
            />
            <Row
              label={`Outbound Dials Needed (${period === "weekly" ? "Weekly" : "Monthly"})`}
              base={scenarios.base.dialsNeeded}
              d15={scenarios.d15.dialsNeeded}
              d30={scenarios.d30.dialsNeeded}
            />
            <SliderRow
              label="Working Days in Period"
              unit="#"
              value={inputs.workingDays}
              min={1}
              max={31}
              step={1}
              onChange={(v) => set({ workingDays: v })}
            />
            <Row label="Outbound Dials Needed / Day" base={scenarios.base.dialsNeededPerDay} d15={scenarios.d15.dialsNeededPerDay} d30={scenarios.d30.dialsNeededPerDay} />
            <SliderRow
              label="Leads (Dials) per Diater / Day"
              unit="#"
              value={inputs.dialsPerRepPerDay}
              min={1}
              max={200}
              step={1}
              onChange={(v) => set({ dialsPerRepPerDay: v })}
            />
            <Row label="Reps Needed (exact)" base={scenarios.base.repsNeededExact} d15={scenarios.d15.repsNeededExact} d30={scenarios.d30.repsNeededExact} highlight />
            <Row label="Reps Needed (round up)" base={scenarios.base.repsNeededRoundUp} d15={scenarios.d15.repsNeededRoundUp} d30={scenarios.d30.repsNeededRoundUp} highlight />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  base,
  d15,
  d30,
  highlight,
}: {
  label: string;
  base: number;
  d15: number;
  d30: number;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-white/5 ${highlight ? "bg-blue-500/10 font-semibold" : ""}`}>
      <td className="px-4 py-3">{label}</td>
      <td className="px-4 py-3 text-white">#</td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3 text-right text-emerald-700">{formatStatValue(base, "number")}</td>
      <td className="px-4 py-3 text-right text-amber-700">{formatStatValue(d15, "number")}</td>
      <td className="px-4 py-3 text-right text-red-700">{formatStatValue(d30, "number")}</td>
    </tr>
  );
}
