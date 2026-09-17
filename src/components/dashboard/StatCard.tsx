import { formatStatValue, type StatFormat } from "@/lib/format";

export type StatCardStatus = "green" | "yellow" | "red" | null;

const STATUS_DOT: Record<Exclude<StatCardStatus, null>, string> = {
  green: "var(--cell-green-bg)",
  yellow: "var(--cell-yellow-bg)",
  red: "var(--cell-red-bg)",
};

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
      className={`rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm ${isLg ? "p-5" : "p-4"}`}
      style={status ? { borderColor: STATUS_DOT[status], borderWidth: 2 } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={`font-semibold uppercase tracking-wide text-[var(--text-muted)] ${isLg ? "text-xs" : "text-xs"}`}
        >
          {label}
        </div>
        {status ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: STATUS_DOT[status] }}
            aria-label={`KPI status: ${status}`}
          />
        ) : null}
      </div>
      <div
        className={`mt-2 font-bold text-[var(--text-strong)] ${isLg ? "text-4xl" : "text-2xl"}`}
      >
        {override ?? formatStatValue(value, format)}
      </div>
      {subtext ? <div className="mt-1 text-xs text-[var(--text-muted)]">{subtext}</div> : null}
      {goal !== undefined ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{goal ?? "No goal set"}</div>
      ) : null}
    </div>
  );
}
