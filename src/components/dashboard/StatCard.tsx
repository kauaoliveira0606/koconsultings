import { formatStatValue, type StatFormat } from "@/lib/format";
import { StatusBar, StatusPill } from "@/components/dashboard/status";

export type StatCardStatus = "green" | "yellow" | "red" | null;

type StatCardProps = {
  label: string;
  value: number | null | undefined;
  format?: StatFormat;
  /** Always-visible formula/explanation — every metric should have one. */
  subtext?: string;
  goal?: string | null;
  /** KPI status vs. goal (green/yellow/red), same scale as the Weekly Scorecard. */
  status?: StatCardStatus;
  /** Show this instead of the formatted value — e.g. "Not Active" when ad spend is $0. */
  override?: string;
  /** "lg" for keystone-tier cards that should visually outweigh everything else. */
  size?: "default" | "lg";
};

export function StatCard({
  label,
  value,
  format = "number",
  subtext,
  goal,
  status,
  override,
  size = "default",
}: StatCardProps) {
  const isLg = size === "lg";
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm ${isLg ? "p-6" : "p-5"}`}
    >
      {status ? <StatusBar status={status} /> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-medium leading-snug text-[var(--text-muted)]">{label}</div>
        {status ? <StatusPill status={status} /> : null}
      </div>
      <div
        className={`mt-2 break-words font-semibold tracking-tight text-[var(--text-strong)] ${isLg ? "text-3xl 2xl:text-4xl" : "text-[28px] leading-9"}`}
      >
        {override ?? formatStatValue(value, format)}
      </div>
      {subtext ? <div className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{subtext}</div> : null}
      {goal !== undefined ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{goal ?? "No goal set"}</div>
      ) : null}
    </div>
  );
}
