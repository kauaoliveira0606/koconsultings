import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";

export type GroupedMetric = {
  label: string;
  value: number | null | undefined;
  format: StatFormat;
  /** One short line on how the number is worked out. */
  subtext?: string;
  status?: StatCardStatus;
  goal?: string | null;
  /** Shown instead of the value, e.g. "Not Active" when no ads ran. */
  override?: string;
};

export type MetricGroup = { title: string; metrics: GroupedMetric[] };

const STATUS_COLOR: Record<Exclude<StatCardStatus, null>, string> = {
  green: "var(--cell-green-bg)",
  yellow: "var(--cell-yellow-bg)",
  red: "var(--cell-red-bg)",
};

/**
 * Headline numbers sorted into titled columns (e.g. Cash | ROAS | Efficiency)
 * so related figures are read together, top to bottom, instead of scanned
 * across an unordered grid of cards.
 */
export function MetricGroups({ groups }: { groups: MetricGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {groups.map((group) => (
        <div
          key={group.title}
          className="flex flex-col rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm"
        >
          <div className="border-b border-[var(--panel-border)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]">
            {group.title}
          </div>
          <div className="flex-1 divide-y divide-[var(--panel-border)]">
            {group.metrics.map((m) => (
              <div key={m.label} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {m.label}
                  </span>
                  {m.status ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[m.status] }}
                      aria-label={`KPI status: ${m.status}`}
                    />
                  ) : null}
                </div>
                <div className="mt-1 text-3xl font-bold text-[var(--text-strong)]">
                  {m.override ?? formatStatValue(m.value, m.format)}
                </div>
                {m.subtext || m.goal ? (
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {[m.subtext, m.goal ? `Goal ${m.goal}` : null].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
