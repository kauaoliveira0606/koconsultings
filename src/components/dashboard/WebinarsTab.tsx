"use client";

import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { WebinarSection } from "@/components/dashboard/WebinarSection";
import type { GoalsConfig } from "@/lib/goals";
import type { WebinarTotals } from "@/lib/metrics";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { easternDateString, resolveRange } from "@/lib/date-range";

const md = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

/** Webinars tab (Bronson + Aval): every webinar number in one place. */
export function WebinarsTab({ offer }: { offer: "bronson" | "aval" }) {
  const { range, setRange } = useSharedRange();
  const { data: webinar } = useSectionData<WebinarTotals & { startDate: string | null }>(`/api/${offer}/webinars`, range);
  const { data: goals } = useSectionData<GoalsConfig>(`/api/${offer}/goals`, range);

  // Pill dates: the range, starting no earlier than the webinar launch and ending no later than today.
  const resolved = resolveRange(range.preset, range.customStart && range.customEnd ? { start: range.customStart, end: range.customEnd } : undefined);
  const today = easternDateString();
  const from = [resolved.start, webinar?.startDate].filter((d): d is string => !!d).sort().pop();
  const to = [resolved.end ?? today, today].sort()[0];
  const period = from && from <= to ? `${md(from)} → ${md(to)}` : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Webinars</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>
      <WebinarSection
        title="Webinar Funnel"
        webinar={webinar}
        goals={goals}
        breakdownApiPath={`/api/${offer}/overview/webinars`}
        period={period}
      />
    </div>
  );
}
