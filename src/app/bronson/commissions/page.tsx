"use client";

import { useMemo, useState } from "react";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { buildPayPeriods } from "@/lib/pay-periods";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type {
  CommissionsResponse,
  CommissionTotalRow,
  HighTicketDeal,
  LowTicketRepRow,
} from "@/lib/airtable/commissions";

const money = (value: number | null | undefined) => formatStatValue(value, "currency");
const pct = (rate: number | undefined) => (rate === undefined ? "" : `${Math.round(rate * 100)}%`);
const sameRep = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.toLowerCase();

function formatDay(date: string | null): string {
  if (!date) return "Unknown";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** One line of a rep's math: what it is, how it was worked out, what it pays. */
function MathLine({ label, math, amount }: { label: string; math: string; amount: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text-strong)]">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{math}</div>
      </div>
      <div className="text-sm font-semibold text-[var(--text-strong)]">{money(amount)}</div>
    </div>
  );
}

function RepCard({
  rank,
  rep,
  lowTicket,
  deals,
  rates,
}: {
  rank: number;
  rep: CommissionTotalRow;
  lowTicket: LowTicketRepRow | undefined;
  deals: HighTicketDeal[];
  rates: CommissionsResponse["rates"];
}) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--panel-subtle)] text-sm font-bold text-[var(--text-muted)]">
            {rank}
          </div>
          <div className="text-lg font-bold text-[var(--text-strong)]">{rep.rep}</div>
        </div>
        <div className="text-3xl font-bold text-[var(--text-strong)]">{money(rep.total)}</div>
      </div>

      <div className="mt-4 divide-y divide-[var(--panel-border)] border-t border-[var(--panel-border)]">
        {lowTicket ? (
          <MathLine
            label="Low Ticket"
            math={
              `${money(lowTicket.realCash)} real cash x ${pct(rates.lowTicket)}` +
              ` · submitted ${money(lowTicket.submittedCash)}` +
              ` · attribution rate ${formatStatValue(lowTicket.attributionRate, "percent")}` +
              ` (${lowTicket.trackedSales}/${lowTicket.submittedSales} sales)`
            }
            amount={lowTicket.commission}
          />
        ) : null}

        {deals.map((deal) => {
          const closed = sameRep(deal.closer, rep.rep);
          const set = sameRep(deal.setter, rep.rep);
          const rate =
            (closed ? rates.highTicketCloser : 0) + (set ? rates.highTicketSetter : 0);
          const role = closed && set ? "set + closed" : closed ? "closed" : "set";
          return (
            <MathLine
              key={deal.id}
              label={`High Ticket · ${deal.lead ?? "Unknown lead"} (${role})`}
              math={
                `${formatDay(deal.date)} · ${money(deal.cashCollected)} cash` +
                ` - ${pct(deal.feeRate)} fee = ${money(deal.netCash)} x ${pct(rate)}`
              }
              amount={(closed ? deal.closerCommission : 0) + (set ? deal.setterCommission : 0)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function CommissionsPage() {
  // Commissions are paid per pay period, so this tab has its own period
  // picker instead of the shared day/week range filter.
  const periods = useMemo(() => buildPayPeriods(), []);
  const defaultKey = periods.find((p) => p.kind === "period")?.key ?? periods[0]?.key ?? "";
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const range: RangeState = {
    preset: "custom",
    customStart: period?.start,
    customEnd: period?.end,
  };
  const { data, error } = useSectionData<CommissionsResponse>("/api/bronson/commissions", range);

  // Reps with only submitted (unattributed) sales still show, at $0, so the gap is visible.
  const reps = data?.byRep ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Commissions</h1>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          Pay period
          <select
            value={period?.key ?? ""}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
          >
            <optgroup label="Pay periods">
              {periods
                .filter((p) => p.kind === "period")
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Full months">
              {periods
                .filter((p) => p.kind === "month")
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load commissions. Retrying.
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {data && reps.length === 0 ? (
          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-center text-sm text-[var(--text-muted)]">
            No commissions in this pay period.
          </div>
        ) : null}

        {data
          ? reps.map((rep, i) => (
              <RepCard
                key={rep.rep}
                rank={i + 1}
                rep={rep}
                lowTicket={data.lowTicket.find((r) => sameRep(r.rep, rep.rep))}
                deals={data.highTicketDeals.filter(
                  (d) => sameRep(d.closer, rep.rep) || sameRep(d.setter, rep.rep)
                )}
                rates={data.rates}
              />
            ))
          : null}

        <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-[var(--accent)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Total Commissions To Pay Out
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Low ticket {money(data?.totals.lowTicketCommission)} + high ticket{" "}
              {money(data?.totals.highTicketCommission)}
            </div>
          </div>
          <div className="text-4xl font-bold text-[var(--text-strong)]">
            {money(data?.totals.commission)}
          </div>
        </div>
      </div>
    </div>
  );
}
