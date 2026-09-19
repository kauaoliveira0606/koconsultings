"use client";

import { useMemo, useState } from "react";
import {
  applyCapacityDownside,
  applyHighTicketDownside,
  computeHighTicketAscension,
  type HighTicketAscensionInputs,
  computeCapacityModel,
  LEADS_PER_REP_PER_DAY,
  type CapacityModelInputs,
} from "@/lib/models/capacity-model";
import { formatStatValue, type StatFormat } from "@/lib/format";

const DEFAULT_HT_INPUTS: HighTicketAscensionInputs = {
  bookingRate: 0.25,
  showRate: 0.6,
  closeRate: 0.25,
  aov: 5000,
  slotsPerCloserPerDay: 4,
};

const DEFAULT_INPUTS: CapacityModelInputs = {
  revenueGoal: 50000,
  aov: 300,
  closeRate: 0.2,
  connectionRate: 0.4,
  workingDays: 22,
  costPerLead: 10,
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
    </tr>
  );
}

export function CapacityModelTab() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [inputs, setInputs] = useState<CapacityModelInputs>(DEFAULT_INPUTS);
  const [ht, setHt] = useState<HighTicketAscensionInputs>(DEFAULT_HT_INPUTS);

  const scenarios = useMemo(() => {
    const base = computeCapacityModel(inputs);
    const d15 = computeCapacityModel(applyCapacityDownside(inputs, 0.85));
    const d30 = computeCapacityModel(applyCapacityDownside(inputs, 0.7));
    return { base, d15, d30 };
  }, [inputs]);

  const ascension = useMemo(() => {
    const at = (s: typeof scenarios.base, h: HighTicketAscensionInputs) =>
      computeHighTicketAscension(s.dealsNeeded, inputs.workingDays, h);
    return {
      base: at(scenarios.base, ht),
      d15: at(scenarios.d15, applyHighTicketDownside(ht, 0.85)),
      d30: at(scenarios.d30, applyHighTicketDownside(ht, 0.7)),
    };
  }, [scenarios, ht, inputs.workingDays]);

  const set = (patch: Partial<CapacityModelInputs>) => setInputs((prev) => ({ ...prev, ...patch }));
  const setHtInput = (patch: Partial<HighTicketAscensionInputs>) =>
    setHt((prev) => ({ ...prev, ...patch }));
  const per = period === "weekly" ? "Week" : "Month";

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setPeriod("weekly");
            set({ workingDays: 5 });
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "weekly" ? "bg-black text-white" : "border border-black/10 bg-white"
          }`}
        >
          Weekly Goal
        </button>
        <button
          type="button"
          onClick={() => {
            setPeriod("monthly");
            set({ workingDays: 22 });
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "monthly" ? "bg-black text-white" : "border border-black/10 bg-white"
          }`}
        >
          Monthly Goal
        </button>
      </div>

      <p className="mb-4 text-sm text-black/60">
        Set a revenue goal and your current funnel rates — this works backward to how many leads
        you need to close, how many reps that takes, what each rep produces, and the ad spend
        needed to generate that lead volume. -15% / -30% show what happens if Close Rate and
        Connection Rate both slip.
      </p>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <TableHead />
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
            <Row label="Deals Needed" base={scenarios.base.dealsNeeded} d15={scenarios.d15.dealsNeeded} d30={scenarios.d30.dealsNeeded} />
            <SliderRow
              label="Close Rate"
              unit="%"
              value={inputs.closeRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ closeRate: v / 100 })}
            />
            <SliderRow
              label="Connection Rate"
              unit="%"
              value={inputs.connectionRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => set({ connectionRate: v / 100 })}
            />
            <Row label="Lead-to-Deal Conversion Rate (Connect × Close)" unit="%" format="percent" base={scenarios.base.leadToDealRate} d15={scenarios.d15.leadToDealRate} d30={scenarios.d30.leadToDealRate} />
            <Row label="Pickups Needed" base={scenarios.base.pickupsNeeded} d15={scenarios.d15.pickupsNeeded} d30={scenarios.d30.pickupsNeeded} />
            <Row
              label={`Leads Required to Hit Deal Number (${period === "weekly" ? "Weekly" : "Monthly"})`}
              base={scenarios.base.leadsRequired}
              d15={scenarios.d15.leadsRequired}
              d30={scenarios.d30.leadsRequired}
              highlight
            />
            <SliderRow
              label={`Working Days per ${per}`}
              unit="#"
              value={inputs.workingDays}
              min={1}
              max={31}
              step={1}
              onChange={(v) => set({ workingDays: v })}
            />
            <Row label="Leads Required / Day" base={scenarios.base.leadsRequiredPerDay} d15={scenarios.d15.leadsRequiredPerDay} d30={scenarios.d30.leadsRequiredPerDay} />
            <Row label="Contacts / Leads per Rep / Day" base={LEADS_PER_REP_PER_DAY} d15={LEADS_PER_REP_PER_DAY} d30={LEADS_PER_REP_PER_DAY} />
            <Row label="Reps Needed (exact)" base={scenarios.base.repsNeededExact} d15={scenarios.d15.repsNeededExact} d30={scenarios.d30.repsNeededExact} highlight />
            <Row label="Reps Needed (round up)" base={scenarios.base.repsNeededRoundUp} d15={scenarios.d15.repsNeededRoundUp} d30={scenarios.d30.repsNeededRoundUp} highlight />
            <Row label={`Deals per Rep / ${per}`} base={scenarios.base.dealsPerRep} d15={scenarios.d15.dealsPerRep} d30={scenarios.d30.dealsPerRep} />
            <Row label={`Revenue per Rep / ${per}`} unit="$" format="currency" base={scenarios.base.revenuePerRep} d15={scenarios.d15.revenuePerRep} d30={scenarios.d30.revenuePerRep} />
            <SliderRow
              label="Cost per Lead"
              unit="$"
              value={inputs.costPerLead}
              min={0}
              max={500}
              step={1}
              onChange={(v) => set({ costPerLead: v })}
            />
            <Row label={`Ad Spend Needed (${period === "weekly" ? "Weekly" : "Monthly"})`} unit="$" format="currency" base={scenarios.base.adSpendNeeded} d15={scenarios.d15.adSpendNeeded} d30={scenarios.d30.adSpendNeeded} highlight />
          </tbody>
        </table>
      </div>

      <h2 className="mb-1 mt-10 text-lg font-bold">High Ticket Ascension</h2>
      <p className="mb-4 text-sm text-black/60">
        Bonus: the extra cash from moving low-ticket buyers up to high ticket. It starts from the
        low-ticket closes above, so it moves with your revenue goal. -15% / -30% degrade Show Rate
        and High Ticket Close Rate.
      </p>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <TableHead />
          <tbody>
            <Row label="Low-Ticket Closes (from Deals Needed above)" base={scenarios.base.dealsNeeded} d15={scenarios.d15.dealsNeeded} d30={scenarios.d30.dealsNeeded} />
            <SliderRow
              label="Low-Ticket Close → High-Ticket Booking Rate"
              unit="%"
              value={ht.bookingRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => setHtInput({ bookingRate: v / 100 })}
            />
            <Row label="High Ticket Calls Booked" base={ascension.base.callsBooked} d15={ascension.d15.callsBooked} d30={ascension.d30.callsBooked} />
            <SliderRow
              label="Show Rate"
              unit="%"
              value={ht.showRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => setHtInput({ showRate: v / 100 })}
            />
            <Row label="High Ticket Calls Showed" base={ascension.base.callsShowed} d15={ascension.d15.callsShowed} d30={ascension.d30.callsShowed} />
            <SliderRow
              label="High Ticket Close Rate"
              unit="%"
              value={ht.closeRate * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => setHtInput({ closeRate: v / 100 })}
            />
            <Row label="High Ticket Deals Closed" base={ascension.base.dealsClosed} d15={ascension.d15.dealsClosed} d30={ascension.d30.dealsClosed} />
            <SliderRow
              label="High Ticket AOV"
              unit="$"
              value={ht.aov}
              min={0}
              max={100000}
              step={100}
              onChange={(v) => setHtInput({ aov: v })}
            />
            <Row label={`Extra Cash from Ascension (${period === "weekly" ? "Weekly" : "Monthly"})`} unit="$" format="currency" base={ascension.base.extraCash} d15={ascension.d15.extraCash} d30={ascension.d30.extraCash} highlight />
            <SliderRow
              label="Calendar Slots Available per Day per Closer"
              unit="#"
              value={ht.slotsPerCloserPerDay}
              min={1}
              max={20}
              step={1}
              onChange={(v) => setHtInput({ slotsPerCloserPerDay: v })}
            />
            <Row label="High Ticket Calls Booked / Day" base={ascension.base.callsBookedPerDay} d15={ascension.d15.callsBookedPerDay} d30={ascension.d30.callsBookedPerDay} />
            <Row label="Closers Needed (exact)" base={ascension.base.closersNeededExact} d15={ascension.d15.closersNeededExact} d30={ascension.d30.closersNeededExact} highlight />
            <Row label="Closers Needed (round up)" base={ascension.base.closersNeededRoundUp} d15={ascension.d15.closersNeededRoundUp} d30={ascension.d30.closersNeededRoundUp} highlight />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase text-black/50">
        <th className="px-4 py-3">Metric</th>
        <th className="px-4 py-3">Unit</th>
        <th className="px-4 py-3">Your Numbers</th>
        <th className="px-4 py-3 text-right text-emerald-600">Base Case</th>
        <th className="px-4 py-3 text-right text-amber-600">-15% Downside</th>
        <th className="px-4 py-3 text-right text-red-600">-30% Downside</th>
      </tr>
    </thead>
  );
}

function Row({
  label,
  base,
  d15,
  d30,
  highlight,
  unit = "#",
  format = "number",
}: {
  label: string;
  base: number;
  d15: number;
  d30: number;
  highlight?: boolean;
  unit?: string;
  format?: StatFormat;
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
