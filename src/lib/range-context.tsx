"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { defaultRangeState, type RangeState } from "@/components/dashboard/RangeFilterBar";

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
export function RangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<RangeState>(defaultRangeState("yesterday"));
  return <RangeContext.Provider value={{ range, setRange }}>{children}</RangeContext.Provider>;
}

export function useSharedRange(): RangeContextValue {
  const ctx = useContext(RangeContext);
  if (!ctx) {
    throw new Error("useSharedRange must be used within a RangeProvider");
  }
  return ctx;
}
