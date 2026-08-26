"use client";

import useSWR from "swr";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
