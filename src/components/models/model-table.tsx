"use client";

import type { ReactNode } from "react";
import { formatStatValue, type StatFormat } from "@/lib/format";

const COLUMN_COUNT = 6;

type NumKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
type StrKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

export function ModelTable({ children }: { children: ReactNode }) {
  return (
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
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SectionRow({ title }: { title: string }) {
  return (
    <tr className="border-b border-black/10 bg-black/[0.03]">
      <td
        colSpan={COLUMN_COUNT}
        className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-black/60"
      >
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

/** Two-option toggle, styled like the Weekly/Monthly buttons on the Capacity tab. */
export function ToggleButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            value === o.id ? "bg-black text-white" : "border border-black/10 bg-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Row builders for a model: inputs (with optional percent + downside columns) and
 * computed rows that pull the same key from all three scenarios.
 */
export function useModelRows<I extends object, R extends object>({
  inputs,
  set,
  d15,
  d30,
  results,
}: {
  inputs: I;
  set: (patch: Partial<I>) => void;
  d15: I;
  d30: I;
  results: { base: R; d15: R; d30: R };
}) {
  const input = (
    label: string,
    unit: string,
    key: NumKeys<I>,
    min: number,
    max: number,
    step: number,
    opts: { percent?: boolean; scenario?: boolean } = {}
  ) => {
    const raw = inputs[key] as number;
    const scale = opts.percent ? 100 : 1;
    const format: StatFormat = opts.percent ? "percent" : unit === "$" ? "currency" : "number";
    return (
      <SliderRow
        label={label}
        unit={unit}
        value={raw * scale}
        min={min}
        max={max}
        step={step}
        onChange={(v) => set({ [key]: v / scale } as Partial<I>)}
        format={format}
        scenarioValues={
          opts.scenario
            ? { base: raw, d15: d15[key] as number, d30: d30[key] as number }
            : undefined
        }
      />
    );
  };

  const row = (
    label: string,
    unit: string,
    key: NumKeys<R>,
    format: StatFormat,
    highlight?: boolean
  ) => (
    <ComputedRow
      label={label}
      unit={unit}
      base={results.base[key] as number}
      d15={results.d15[key] as number}
      d30={results.d30[key] as number}
      format={format}
      highlight={highlight}
    />
  );

  const check = (label: string, unit: string, good: string, key: StrKeys<R>) => (
    <CheckRow
      label={label}
      unit={unit}
      good={good}
      base={results.base[key] as string}
      d15={results.d15[key] as string}
      d30={results.d30[key] as string}
    />
  );

  return { input, row, check };
}
