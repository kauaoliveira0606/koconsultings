"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { defaultRangeState, type RangeState } from "@/components/dashboard/RangeFilterBar";
import type { RangePreset } from "@/lib/date-range";

type RangeContextValue = {
  range: RangeState;
  setRange: (next: RangeState) => void;
};

const RangeContext = createContext<RangeContextValue | null>(null);

/**
 * Holds the selected date range at the layout level so it survives
 * client-side navigation between an offer's pages (Overview <-> Sales Team)
 * instead of resetting to a default every time the route changes.
 */
export function RangeProvider({
  children,
  initialPreset = "last_7_days",
  refreshIntervalMs,
}: {
  children: ReactNode;
  initialPreset?: RangePreset;
  /** Re-fetch every section's data on this interval (and on tab focus) so a
   * dashboard left open all day stays current without a manual reload. */
  refreshIntervalMs?: number;
}) {
  const [range, setRange] = useState<RangeState>(defaultRangeState(initialPreset));
  const provider = (
    <RangeContext.Provider value={{ range, setRange }}>{children}</RangeContext.Provider>
  );
  if (!refreshIntervalMs) return provider;
  return (
    <SWRConfig value={{ refreshInterval: refreshIntervalMs, revalidateOnFocus: true }}>
      {provider}
    </SWRConfig>
  );
}

export function useSharedRange(): RangeContextValue {
  const ctx = useContext(RangeContext);
  if (!ctx) {
    throw new Error("useSharedRange must be used within a RangeProvider");
  }
  return ctx;
}
