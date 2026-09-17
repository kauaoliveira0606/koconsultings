import { formatStatValue } from "@/lib/format";

type Point = { date: string; cash: number; adSpend: number };

/** Dependency-free SVG line chart — no charting library in this project, and this is the only place that needs one. */
export function CashVsSpendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-sm text-[var(--text-muted)]">
        No data in this range.
      </div>
    );
  }

  const width = 1000;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.cash, d.adSpend)));
  const x = (i: number) => padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - (v / maxValue) * innerH;

  const linePath = (key: "cash" | "adSpend") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");

  const cashArea = `${linePath("cash")} L ${x(data.length - 1)} ${padding.top + innerH} L ${x(0)} ${padding.top + innerH} Z`;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <div className="mb-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#818cf8" }} /> Cash
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#64748b" }} /> Ad Spend
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        {tickValues.map((v) => (
          <g key={v}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--panel-border)"
              strokeDasharray={v === 0 ? undefined : "3 3"}
            />
            <text x={padding.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">
              {formatStatValue(v, "currency").replace(".00", "")}
            </text>
          </g>
        ))}
        <path d={cashArea} fill="#818cf8" fillOpacity={0.15} stroke="none" />
        <path d={linePath("cash")} fill="none" stroke="#818cf8" strokeWidth={2.5} />
        <path d={linePath("adSpend")} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray="4 3" />
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="11"
              fill="var(--text-muted)"
            >
              {d.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
