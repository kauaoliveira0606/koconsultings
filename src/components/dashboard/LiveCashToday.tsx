"use client";

import useSWR from "swr";
import { formatStatValue } from "@/lib/format";
import { BUSINESS_TIME_ZONE } from "@/lib/date-range";
import type { LiveCashResponse, LiveCashSourceTotal } from "@/lib/airtable/live-cash";

const REFRESH_MS = 60_000;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

function easternTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function SourceCard({
  label,
  entryNoun,
  source,
}: {
  label: string;
  entryNoun: string;
  source: LiveCashSourceTotal | undefined;
}) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-[var(--text-strong)]">
        {formatStatValue(source?.cash, "currency")}
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">
        {source
          ? `${source.entries} ${entryNoun}${source.entries === 1 ? "" : "s"} · last at ${easternTime(source.lastEntryAt)} ET`
          : "Loading…"}
      </div>
    </div>
  );
}

/**
 * Today's cash so far (Eastern day), summed live from Post Call Notes,
 * Affiliate PCN and Follow Up Payment only, re-polled every minute. Ignores the page's range filter.
 */
export function LiveCashToday({ apiPath }: { apiPath: string }) {
  const { data, error } = useSWR<LiveCashResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
    refreshWhenHidden: false,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Cash Collected Today
          </div>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <div className="mt-2 text-4xl font-bold text-[var(--text-strong)]">
          {formatStatValue(data?.total, "currency")}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {error && !data
            ? "Couldn't load, retrying…"
            : data
              ? `${data.date} · updated ${easternTime(data.fetchedAt)} ET · refreshes every minute`
              : "Loading…"}
        </div>
      </div>
      <SourceCard label="Post Call Notes (High Ticket)" entryNoun="close" source={data?.postCallNotes} />
      <SourceCard label="Affiliate PCN (Software)" entryNoun="sale" source={data?.affiliatePcn} />
      <SourceCard label="Follow Up Payments" entryNoun="payment" source={data?.followUpPayments} />
    </div>
  );
}
