import type { StatCardStatus } from "@/components/dashboard/StatCard";

type Status = Exclude<StatCardStatus, null>;

/** Solid status colors for bars and pills (the cell tokens are tinted fills). */
export const STATUS_SOLID: Record<Status, string> = {
  green: "#34d399",
  yellow: "#fbbf24",
  red: "#fb7185",
};

const STATUS_LABEL: Record<Status, string> = {
  green: "On track",
  yellow: "Watch",
  red: "Off track",
};

/** Small "On track / Watch / Off track" pill shown next to a KPI's label. */
export function StatusPill({ status }: { status: Status }) {
  const color = STATUS_SOLID[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
      aria-label={`KPI status: ${status}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Thin colored bar across the top of a card that has a KPI status. */
export function StatusBar({ status }: { status: Status }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-[3px]"
      style={{ background: `linear-gradient(90deg, ${STATUS_SOLID[status]}, ${STATUS_SOLID[status]}55)` }}
    />
  );
}
