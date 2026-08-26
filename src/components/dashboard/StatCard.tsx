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
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/60">{label}</div>
      <div className="mt-2 text-2xl font-bold text-black">{formatStatValue(value, format)}</div>
      {subtext ? <div className="mt-1 text-xs text-black/50">{subtext}</div> : null}
      {goal !== undefined ? (
        <div className="mt-1 text-xs text-black/50">{goal ?? "No goal set"}</div>
      ) : null}
    </div>
  );
}
