"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { SWRConfig, useSWRConfig, type Middleware } from "swr";
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
 * Every section's last answer is kept in this browser, so a reload or a new
 * visit shows the last numbers straight away instead of "Loading" while the
 * API answers (user, 2026-10-27: load and refresh too slow). The live request
 * still goes out and replaces them as soon as it lands. Copies older than a
 * day are dropped, and the newest are kept when storage runs short.
 */
const SAVED_KEY = "koc-sections-v1";
const SAVED_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVED_MAX_CHARS = 3_000_000;
type Saved = Record<string, { at: number; data: unknown }>;
let saved: Saved | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function readSaved(): Saved {
  if (saved) return saved;
  saved = {};
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Saved;
    for (const [key, entry] of Object.entries(raw)) {
      if (entry && Date.now() - entry.at < SAVED_MAX_AGE_MS) saved[key] = entry;
    }
  } catch {
    // Storage blocked or unreadable: sections just load from the API.
  }
  return saved;
}

function writeSaved() {
  const keep: Saved = {};
  let size = 0;
  for (const [key, entry] of Object.entries(readSaved()).sort((a, b) => b[1].at - a[1].at)) {
    const chars = JSON.stringify(entry).length;
    if (size + chars > SAVED_MAX_CHARS) continue;
    keep[key] = entry;
    size += chars;
  }
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(keep));
  } catch {
    // Full or blocked: nothing saved this time.
  }
}

function remember(key: string, data: unknown) {
  readSaved()[key] = { at: Date.now(), data };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeSaved, 1000);
}

/**
 * Puts the saved answers into SWR's cache. A layout effect placed before the
 * page, so it runs before the sections start their requests (a fill made
 * after a request started would make SWR drop that request's answer), and
 * after hydration, so the server HTML still matches.
 */
function RestoreSaved() {
  const { cache, mutate } = useSWRConfig();
  useLayoutEffect(() => {
    for (const [key, entry] of Object.entries(readSaved())) {
      if (cache.get(key)?.data === undefined) void mutate(key, entry.data, { revalidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

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
        onSuccess: (data, key) => remember(key, data),
        ...(refreshIntervalMs ? { refreshInterval: refreshIntervalMs, revalidateOnFocus: true } : {}),
      }}
    >
      <RestoreSaved />
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
