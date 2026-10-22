"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SWRConfig, type Middleware } from "swr";
import { defaultRangeState, type RangeState } from "@/components/dashboard/RangeFilterBar";
import type { RangePreset } from "@/lib/date-range";

type RangeContextValue = {
  range: RangeState;
  setRange: (next: RangeState) => void;
};

const RangeContext = createContext<RangeContextValue | null>(null);

/**
 * The API answers from a cached copy straight away and refreshes that copy
 * in the background (see staleWhileRevalidate in lib/airtable/client.ts),
 * so every section asks once more a few seconds after it loads to pick up
 * the refreshed numbers.
 */
const REFETCH_AFTER_MS = 6000;
const refetchOnceSoon: Middleware = (useSWRNext) => (key, fetcher, config) => {
  const swr = useSWRNext(key, fetcher, config);
  const serialized = typeof key === "string" ? key : JSON.stringify(key);
  const { mutate } = swr;
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => void mutate(), REFETCH_AFTER_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
  return swr;
};

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
  return (
    <SWRConfig
      value={{
        use: [refetchOnceSoon],
        ...(refreshIntervalMs ? { refreshInterval: refreshIntervalMs, revalidateOnFocus: true } : {}),
      }}
    >
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
