"use client";

import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { WebinarSection } from "@/components/dashboard/WebinarSection";
import type { GoalsConfig } from "@/lib/goals";
import type { WebinarTotals } from "@/lib/metrics";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";

/** Webinars tab (Bronson + Aval): every webinar number in one place. */
export function WebinarsTab({ offer }: { offer: "bronson" | "aval" }) {
  const { range, setRange } = useSharedRange();
  const { data: webinar } = useSectionData<WebinarTotals>(`/api/${offer}/webinars`, range);
  const { data: goals } = useSectionData<GoalsConfig>(`/api/${offer}/goals`, range);

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
      />
    </div>
  );
}
