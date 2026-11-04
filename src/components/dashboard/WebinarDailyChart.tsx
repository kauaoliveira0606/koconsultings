"use client";

import { useEffect, useRef, useState } from "react";
import type { WebinarDay } from "@/lib/webinar-source-funnel";

/** Round tick step (1, 2, 2.5 or 5 × a power of ten) so axis labels are clean numbers. */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

const axisMoney = (v: number) =>
  v >= 1_000_000 ? `$${+(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${+(v / 1_000).toFixed(1)}K` : `$${Math.round(v)}`;
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const mmdd = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

const SPEND = "var(--chart-spend)";
const CASH = "var(--chart-cash)";

/**
 * Daily ad spend vs cash collected across every webinar's days (user,
 * 2026-11-04). Dates along the bottom, dollars up the left, one shared axis.
 * Hover (or tap) a day for its numbers.
 */
export function WebinarDailyChart({ days, webinars }: { days: WebinarDay[]; webinars: { number: number; date: string }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!days.length) return null;

  const narrow = width < 560;
  const height = narrow ? 240 : 300;
  const pad = { top: 16, right: 16, bottom: 28, left: narrow ? 48 : 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const ticks = 4;
  const step = niceStep(Math.max(1, ...days.map((d) => Math.max(d.adSpend, d.cashCollected))) / ticks);
  const max = step * ticks;
  const x = (i: number) => pad.left + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const base = pad.top + innerH;

  const line = (key: "adSpend" | "cashCollected") => days.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join("");
  const area = (key: "adSpend" | "cashCollected") => `${line(key)}L${x(days.length - 1)},${base}L${x(0)},${base}Z`;
  const labelEvery = Math.max(1, Math.ceil(days.length / (narrow ? 5 : 10)));
  const index = new Map(days.map((d, i) => [d.date, i]));
  const marks = webinars.filter((w) => index.has(w.date));

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = clientX - rect.left - pad.left;
    setHover(Math.min(days.length - 1, Math.max(0, Math.round((rel / innerW) * (days.length - 1)))));
  };

  const h = hover !== null ? days[hover] : null;
  const totalSpend = days.reduce((s, d) => s + d.adSpend, 0);
  const totalCash = days.reduce((s, d) => s + d.cashCollected, 0);

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Daily Ad Spend vs Cash Collected</p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {mmdd(days[0].date)} to {mmdd(days[days.length - 1].date)}: {money(totalSpend)} spent, {money(totalCash)} collected
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text)]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: SPEND }} /> Ad Spend
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: CASH }} /> Cash Collected
          </span>
        </div>
      </div>

      <div
        ref={box}
        className="relative touch-pan-y select-none"
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
      >
        <svg width={width} height={height} role="img" aria-label="Daily ad spend and cash collected" className="block">
          {Array.from({ length: ticks + 1 }, (_, i) => step * i).map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--panel-border)" strokeDasharray={v ? "3 4" : undefined} />
              <text x={pad.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">
                {axisMoney(v)}
              </text>
            </g>
          ))}
          {marks.map((w) => (
            <g key={w.date}>
              <line x1={x(index.get(w.date)!)} x2={x(index.get(w.date)!)} y1={pad.top} y2={base} stroke="var(--text-muted)" strokeOpacity={0.35} strokeDasharray="2 4" />
              <text x={x(index.get(w.date)!) + 4} y={pad.top + 10} fontSize="10" fill="var(--text-muted)">
                Webinar #{w.number}
              </text>
            </g>
          ))}
          <path d={area("adSpend")} fill={SPEND} fillOpacity={0.14} />
          <path d={area("cashCollected")} fill={CASH} fillOpacity={0.08} />
          <path d={line("cashCollected")} fill="none" stroke={CASH} strokeWidth={2} strokeLinejoin="round" />
          <path d={line("adSpend")} fill="none" stroke={SPEND} strokeWidth={2} strokeLinejoin="round" />
          {days.length <= 45
            ? days.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d.adSpend)} r={2.5} fill={SPEND} />)
            : null}
          {days.map((d, i) =>
            i % labelEvery === 0 || i === days.length - 1 ? (
              <text key={d.date} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--text-muted)">
                {mmdd(d.date)}
              </text>
            ) : null,
          )}
          {h ? (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={pad.top} y2={base} stroke="var(--text-muted)" strokeDasharray="3 3" />
              <circle cx={x(hover!)} cy={y(h.cashCollected)} r={5} fill={CASH} stroke="var(--panel-bg)" strokeWidth={2} />
              <circle cx={x(hover!)} cy={y(h.adSpend)} r={5} fill={SPEND} stroke="var(--panel-bg)" strokeWidth={2} />
            </g>
          ) : null}
        </svg>
        {h ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-lg border border-[var(--panel-border)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: x(hover!) > width / 2 ? undefined : x(hover!) + 12,
              right: x(hover!) > width / 2 ? width - x(hover!) + 12 : undefined,
              background: "var(--panel-bg)",
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="mb-1 font-semibold text-[var(--text-strong)]">{mmdd(h.date)}</p>
            <p className="flex items-center justify-between gap-4 text-[var(--text)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SPEND }} /> Ad Spend
              </span>
              <span className="font-semibold text-[var(--text-strong)]">{money(h.adSpend)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-[var(--text)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CASH }} /> Cash Collected
              </span>
              <span className="font-semibold text-[var(--text-strong)]">{money(h.cashCollected)}</span>
            </p>
            {h.cashCollected ? (
              <p className="mt-1 text-[var(--text-muted)]">
                VIP {money(h.vipCash)} · Calls {money(h.callCash)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-3 text-xs font-semibold text-[var(--accent)]">
        {showTable ? "Hide daily table" : "Show daily table"}
      </button>
      {showTable ? (
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3 text-right">Ad Spend</th>
                <th className="py-1.5 pr-3 text-right">VIP Cash</th>
                <th className="py-1.5 pr-3 text-right">Call Cash</th>
                <th className="py-1.5 text-right">Cash Collected</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-white/[0.06] text-[var(--text)]">
                  <td className="py-1.5 pr-3">{mmdd(d.date)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(d.adSpend)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(d.vipCash)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(d.callCash)}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--text-strong)]">{money(d.cashCollected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
