import type { StatCardStatus } from "@/components/dashboard/StatCard";
import { formatStatValue, type StatFormat } from "@/lib/format";
import { StatusPill } from "@/components/dashboard/status";

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

/**
 * Headline numbers sorted into titled columns (e.g. Cash | ROAS | Efficiency)
 * so related figures are read together, top to bottom, instead of scanned
 * across an unordered grid of cards.
 */
export function MetricGroups({ groups }: { groups: MetricGroup[] }) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${groups.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
      {groups.map((group) => (
        <div
          key={group.title}
          className="flex flex-col overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 border-b border-[var(--panel-border)] bg-[var(--panel-subtle)] px-5 py-3">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-300" />
            <span className="text-sm font-semibold text-[var(--text-strong)]">{group.title}</span>
          </div>
          <div className="flex-1 divide-y divide-[var(--panel-border)]">
            {group.metrics.map((m) => (
              <div key={m.label} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium leading-snug text-[var(--text-muted)]">{m.label}</span>
                  {m.status ? <StatusPill status={m.status} /> : null}
                </div>
                <div className="mt-1.5 text-[28px] font-semibold leading-9 tracking-tight text-[var(--text-strong)]">
                  {m.override ?? formatStatValue(m.value, m.format)}
                </div>
                {m.subtext || m.goal ? (
                  <div className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
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
