import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";

const HERO_GRADIENT_VALUE = "linear-gradient(100deg, #7ff0dc 0%, #4fd1e8 40%, #4f9dff 100%)";
/** The cyan to blue gradient, for headline numbers outside a HeroStat. */
export const HERO_GRADIENT = HERO_GRADIENT_VALUE;

/** Smooth number gradients: cyan to blue when there's no goal, else the KPI status. */
const GRADIENT: Record<"none" | Exclude<StatCardStatus, null>, string> = {
  none: HERO_GRADIENT_VALUE,
  green: "linear-gradient(100deg, #a7f3d0 0%, #4ade80 45%, #2dd4bf 100%)",
  yellow: "linear-gradient(100deg, #fde68a 0%, #fbbf24 50%, #fb923c 100%)",
  red: "linear-gradient(100deg, #fecdd3 0%, #fb7185 50%, #f43f5e 100%)",
};

const STATUS_WORD: Record<Exclude<StatCardStatus, null>, string> = {
  green: "On track",
  yellow: "Watch",
  red: "Off track",
};

/** Big money reads cleaner without cents. */
function heroValue(value: number | null | undefined, format: StatFormat): string {
  if (format === "currency" && value !== null && value !== undefined && Math.abs(value) >= 100) {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  return formatStatValue(value, format);
}

/** Long numbers step the size down so they never clip in a four-column row. */
function sizeClass(chars: number, size: "lg" | "md"): string {
  if (size === "lg") {
    if (chars <= 5) return "text-5xl sm:text-6xl";
    if (chars <= 7) return "text-5xl xl:text-[3.25rem]";
    return "text-4xl sm:text-5xl xl:text-[2.6rem]";
  }
  if (chars <= 6) return "text-4xl sm:text-[2.75rem]";
  return "text-4xl xl:text-[2.25rem]";
}

/**
 * The headline card: small tracked label, period pill, a large gradient
 * number and one quiet line under it. For the few numbers checked first.
 */
export function HeroStat({
  label,
  value,
  format,
  period,
  sub,
  goal,
  status = null,
  override,
  size = "lg",
}: {
  label: string;
  value: number | null | undefined;
  format: StatFormat;
  period?: string | null;
  sub?: string;
  goal?: string | null;
  status?: StatCardStatus;
  override?: string;
  size?: "lg" | "md";
}) {
  const statusLine = status ? STATUS_WORD[status] : null;
  const display = override ?? heroValue(value, format);
  return (
    <div
      className="ko-hero relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]"
      style={{ background: "linear-gradient(160deg, rgba(30,41,59,0.75) 0%, rgba(13,18,30,0.92) 60%, rgba(10,14,24,0.95) 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl"
        style={{ background: GRADIENT[status ?? "none"] }}
      />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{label}</span>
        {period ? (
          <span className="rounded-full border border-sky-400/40 bg-sky-400/[0.08] px-2.5 py-0.5 text-xs font-medium tabular-nums text-sky-300">
            {period}
          </span>
        ) : null}
      </div>
      <div
        data-status={status ?? "none"}
        className={`ko-hero-value relative mt-3 whitespace-nowrap font-extrabold leading-none tracking-tight tabular-nums ${sizeClass(display.length, size)}`}
        style={{ backgroundImage: GRADIENT[status ?? "none"], WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
      >
        {display}
      </div>
      {sub || goal || statusLine ? (
        <div className="relative mt-3 text-sm text-slate-400">
          {[statusLine, goal ? `Goal ${goal}` : null, sub].filter(Boolean).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
