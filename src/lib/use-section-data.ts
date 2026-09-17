"use client";

import useSWR from "swr";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";

/**
 * A route handler that throws (e.g. a transient Airtable rate-limit error
 * during a cold cache) still returns a 200-shaped JSON body like
 * `{"error": "..."}` from Next's default error handling — `res.json()`
 * "succeeds" on that, so without checking `res.ok` first, SWR treats a
 * failed request as a successful one with the wrong shape and never
 * retries. The section then renders blank forever until something else
 * (like navigating away and back) triggers a fresh fetch. Throwing here
 * instead makes SWR see it as an error and use its built-in automatic
 * retry (exponential backoff), so a transient failure heals itself in a
 * few seconds instead of needing a remount.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed (${res.status})`);
  }
  return res.json();
};

export function rangeToQuery(range: RangeState): string {
  const params = new URLSearchParams({ preset: range.preset });
  if (range.preset === "custom" && range.customStart && range.customEnd) {
    params.set("start", range.customStart);
    params.set("end", range.customEnd);
  }
  return params.toString();
}

export function useSectionData<T>(path: string, range: RangeState) {
  const query = rangeToQuery(range);
  const { data, error, isLoading } = useSWR<T>(`${path}?${query}`, fetcher);
  return { data, error, isLoading };
}
