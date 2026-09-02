import { formatStatValue, type StatFormat } from "@/lib/format";

type StatCardProps = {
  label: string;
  value: number | null | undefined;
  format?: StatFormat;
  subtext?: string;
  goal?: string | null;
};

export function StatCard({ label, value, format = "number", subtext, goal }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--text-strong)]">{formatStatValue(value, format)}</div>
      {subtext ? <div className="mt-1 text-xs text-[var(--text-muted)]">{subtext}</div> : null}
      {goal !== undefined ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{goal ?? "No goal set"}</div>
      ) : null}
    </div>
  );
}
