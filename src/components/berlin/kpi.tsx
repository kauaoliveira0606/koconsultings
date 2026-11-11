import type { ReactNode } from "react";
import { formatStatValue, type StatFormat } from "@/lib/format";

export type Tone = "green" | "yellow" | "red" | null;

/**
 * The user's KPI lines (project memory, 2026-10-14 / 10-29), for conditional
 * formatting on the Berlin ads, pace and funnel tables. Rates are fractions.
 * min: green at or above `good`, red under `bad`. max: green at or under `good`, red over `bad`.
 */
export const KPI_LINES = {
  roas: { dir: "min", good: 3, bad: 2.4 },
  lpConnectRate: { dir: "min", good: 0.8, bad: 0.7 },
  optInRate: { dir: "min", good: 0.3, bad: 0.2 },
  hookRate: { dir: "min", good: 0.3, bad: 0.3 },
  holdRate: { dir: "min", good: 0.25, bad: 0.15 },
  linkCtr: { dir: "min", good: 0.02, bad: 0.005 },
  cpm: { dir: "max", good: 20, bad: 80 },
  frequency: { dir: "max", good: 2, bad: 3.5 },
  costPerOptIn: { dir: "max", good: 15, bad: 18 },
} as const;

export type KpiKey = keyof typeof KPI_LINES;

export function toneFor(key: KpiKey, value: number | null | undefined): Tone {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const l = KPI_LINES[key];
  if (l.dir === "min") return value >= l.good ? "green" : value < l.bad ? "red" : "yellow";
  return value <= l.good ? "green" : value > l.bad ? "red" : "yellow";
}

const TONE_STYLE: Record<Exclude<Tone, null>, React.CSSProperties> = {
  green: { background: "var(--cell-green-bg)", color: "var(--cell-green-text)" },
  yellow: { background: "var(--cell-yellow-bg)", color: "var(--cell-yellow-text)" },
  red: { background: "var(--cell-red-bg)", color: "var(--cell-red-text)" },
};

/** A number with its KPI tint (or plain when there's no line for it). */
export function KpiValue({ value, format, tone, bold }: { value: number | null | undefined; format: StatFormat; tone?: Tone; bold?: boolean }) {
  const text = formatStatValue(value ?? null, format);
  if (tone) {
    return (
      <span className={`inline-block rounded-md px-1.5 py-0.5 tabular-nums ${bold ? "font-bold" : "font-semibold"}`} style={TONE_STYLE[tone]}>
        {text}
      </span>
    );
  }
  return <span className={`tabular-nums ${bold ? "font-bold" : ""} ${value == null ? "text-[var(--text-muted)]" : ""}`}>{text}</span>;
}

/** Status pill like Manos: GREEN / YELLOW / RED / no target. */
export function TonePill({ tone, label }: { tone: Tone; label?: ReactNode }) {
  if (!tone) return <span className="text-[12px] text-[var(--text-muted)]">no target</span>;
  const dot = { green: "#059669", yellow: "#d97706", red: "#e11d48" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={TONE_STYLE[tone]}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {label ?? tone}
    </span>
  );
}

/** Tiny trend line. Null points are skipped. */
export function Sparkline({ values, color = "var(--accent)", width = 84, height = 22 }: { values: (number | null)[]; color?: string; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null && Number.isFinite(p.v));
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.25} fill={color} />
    </svg>
  );
}
