"use client";

import { useState } from "react";

export type PieSlice = {
  key: string;
  label: string;
  value: number;
  /** Extra context shown on the slice's legend row (cash, deal value, ...). */
  detail?: string;
};

/**
 * Categorical colors, assigned in this fixed order and never cycled: a slice
 * keeps its color whatever the date range does to the others. Validated as a
 * set on the dashboard's dark surface for color-blind separation and contrast.
 */
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

const SIZE = 200;
const RADIUS = 92;
const INNER = 58;
/** Gap between neighbouring slices, in radians, so they read as separate marks. */
const PAD = 0.03;

function point(angle: number, radius: number): string {
  // Angle 0 is 12 o'clock, going clockwise.
  return `${SIZE / 2 + radius * Math.sin(angle)} ${SIZE / 2 - radius * Math.cos(angle)}`;
}

function arcPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(start, RADIUS)}`,
    `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${point(end, RADIUS)}`,
    `L ${point(end, INNER)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(start, INNER)}`,
    "Z",
  ].join(" ");
}

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

/**
 * Part-to-whole pie (drawn as a ring, with the total in the middle) plus a
 * legend that lists every slice's count and share, so nothing depends on
 * hovering or on telling colors apart. Hovering or tabbing to a slice or its
 * legend row highlights it and puts its numbers in the middle.
 */
export function PieSplit({
  slices,
  unit,
  emptyText,
}: {
  slices: PieSlice[];
  /** What is being counted, singular and plural: ["deal", "deals"]. */
  unit: [string, string];
  emptyText: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((t, s) => t + s.value, 0);
  const noun = (n: number) => (n === 1 ? unit[0] : unit[1]);

  if (total === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{emptyText}</p>;
  }

  const drawn = slices.filter((s) => s.value > 0);
  // Each slice starts where the ones before it end.
  const arcs = drawn.map((s, i) => {
    const before = drawn.slice(0, i).reduce((t, d) => t + d.value, 0);
    const from = (before / total) * Math.PI * 2;
    const sweep = (s.value / total) * Math.PI * 2;
    const pad = drawn.length > 1 ? Math.min(PAD, sweep / 4) : 0;
    return { slice: s, start: from + pad / 2, end: from + sweep - pad / 2 };
  });
  const color = (key: string) => SERIES[slices.findIndex((s) => s.key === key) % SERIES.length];
  const focus = slices.find((s) => s.key === active);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-48 w-48 shrink-0"
        role="img"
        aria-label={slices.map((s) => `${s.label}: ${s.value} ${noun(s.value)}, ${percent(s.value / total)}`).join(". ")}
      >
        {arcs.map(({ slice, start, end }) =>
          // A lone slice is a full ring, which a single arc can't draw.
          drawn.length === 1 ? (
            <circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={(RADIUS + INNER) / 2}
              fill="none"
              stroke={color(slice.key)}
              strokeWidth={RADIUS - INNER}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            />
          ) : (
            <path
              key={slice.key}
              d={arcPath(start, end)}
              fill={color(slice.key)}
              opacity={active === null || active === slice.key ? 1 : 0.35}
              tabIndex={0}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(slice.key)}
              onBlur={() => setActive(null)}
              className="cursor-pointer outline-none transition-opacity"
            >
              <title>{`${slice.label}: ${slice.value} ${noun(slice.value)} (${percent(slice.value / total)})`}</title>
            </path>
          )
        )}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          textAnchor="middle"
          className="fill-[var(--text-strong)] text-[30px] font-bold"
        >
          {focus ? percent(focus.value / total) : total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 18}
          textAnchor="middle"
          className="fill-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-wide"
        >
          {focus ? `${focus.value} ${noun(focus.value)}` : `total ${noun(total)}`}
        </text>
      </svg>

      <ul className="w-full min-w-0 flex-1 divide-y divide-[var(--panel-border)] text-sm">
        {slices.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            className={`flex items-center gap-3 py-2 transition-opacity ${
              active !== null && active !== s.key ? "opacity-50" : ""
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: color(s.key) }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[var(--text-strong)]">{s.label}</div>
              {s.detail ? (
                <div className="truncate text-xs text-[var(--text-muted)]">{s.detail}</div>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-bold text-[var(--text-strong)]">{percent(s.value / total)}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {s.value} {noun(s.value)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
