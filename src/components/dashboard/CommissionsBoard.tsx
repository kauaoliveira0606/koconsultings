"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { addDaysToDateString, easternDateString, toEasternDateOnly } from "@/lib/date-range";
import { formatDateTime } from "@/lib/format";
import type { Clawback } from "@/lib/airtable/clawbacks";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { buildPayPeriods, type PayPeriodOptions } from "@/lib/pay-periods";
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

const inputClass =
  "rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]";

/** Clawbacks are handled by hand: type the amount here and it comes off this rep's total. */
function AddClawback({
  apiPath,
  rep,
  date,
  onSaved,
}: {
  apiPath: string;
  rep: string;
  date: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch(`${apiPath}/clawbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rep, date, amount: value, note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setAmount("");
      setNote("");
      setOpen(false);
      setStatus("idle");
      onSaved();
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-[var(--text-muted)] underline-offset-2 hover:underline"
      >
        + Add clawback
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount ($)"
        aria-label="Clawback amount"
        className={`${inputClass} w-32`}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (optional)"
        aria-label="Clawback reason"
        className={`${inputClass} min-w-0 flex-1`}
      />
      <button
        type="button"
        onClick={save}
        disabled={!valid || status === "saving"}
        className="rounded-md bg-[var(--btn-active-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-active-fg)] disabled:opacity-40"
      >
        {status === "saving" ? "Saving..." : "Save clawback"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-[var(--text-muted)] underline-offset-2 hover:underline"
      >
        Cancel
      </button>
      {status === "error" ? (
        <span className="text-xs text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</span>
      ) : null}
    </div>
  );
}

function ClawbackLine({
  apiPath,
  clawback,
  onRemoved,
}: {
  apiPath: string;
  clawback: Clawback;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      await fetch(`${apiPath}/clawbacks?id=${clawback.id}`, { method: "DELETE" });
      onRemoved();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text-strong)]">Clawback</div>
        <div className="text-xs text-[var(--text-muted)]">
          {formatDay(clawback.date)}
          {clawback.note ? ` · ${clawback.note}` : ""} ·{" "}
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className="underline underline-offset-2 disabled:opacity-40"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
      <div className="text-sm font-semibold text-[var(--text-strong)]">
        -{money(clawback.amount)}
      </div>
    </div>
  );
}

type PayoutStatus = { tone: "green" | "yellow" | "red"; title: string; detail: string };

/** Green only once the pay period is over AND the portal has synced since it closed. */
function payoutStatus(periodEnd: string | undefined, portalSyncedAt: string | null): PayoutStatus {
  const synced = portalSyncedAt ? `Portal last synced ${formatDateTime(portalSyncedAt)}.` : "";
  if (!periodEnd || easternDateString() <= periodEnd) {
    return {
      tone: "yellow",
      title: "Pay period still open",
      detail: `Numbers will keep moving until it closes. ${synced}`,
    };
  }
  const syncedDay = toEasternDateOnly(portalSyncedAt);
  if (syncedDay && syncedDay > periodEnd) {
    return { tone: "green", title: "Final. Ready to pay out", detail: synced };
  }
  return {
    tone: "red",
    title: "Not final yet",
    detail: `The portal has not synced since this period closed. It syncs at 4am and 7am ET. ${synced}`,
  };
}

function RepCard({
  apiPath,
  rank,
  rep,
  lowTicket,
  deals,
  clawbacks,
  clawbackDate,
  onChanged,
  rates,
}: {
  apiPath: string;
  rank: number;
  rep: CommissionTotalRow;
  lowTicket: LowTicketRepRow | undefined;
  deals: HighTicketDeal[];
  clawbacks: Clawback[];
  /** Date a new clawback is filed under, always inside the selected pay period. */
  clawbackDate: string;
  onChanged: () => void;
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
              label={`${deal.kind === "follow_up" ? "Follow Up Payment" : "High Ticket"} · ${deal.lead ?? "Unknown lead"} (${role})`}
              math={
                `${formatDay(deal.date)} · ${money(deal.cashCollected)} cash` +
                ` - ${pct(deal.feeRate)} fee = ${money(deal.netCash)} x ${pct(rate)}`
              }
              amount={(closed ? deal.closerCommission : 0) + (set ? deal.setterCommission : 0)}
            />
          );
        })}

        {clawbacks.map((c) => (
          <ClawbackLine key={c.id} apiPath={apiPath} clawback={c} onRemoved={onChanged} />
        ))}
      </div>

      <AddClawback apiPath={apiPath} rep={rep.rep} date={clawbackDate} onSaved={onChanged} />
    </div>
  );
}

/**
 * An offer's Commissions tab: reps ranked by what they are owed, the math
 * under each, and the total to pay out. `apiPath` is the offer's commissions
 * route (its clawbacks route lives at `${apiPath}/clawbacks`).
 */
export function CommissionsBoard({
  apiPath,
  payPeriods,
}: {
  apiPath: string;
  payPeriods: PayPeriodOptions;
}) {
  // Commissions are paid per pay period, so this tab has its own period
  // picker instead of the shared day/week range filter.
  const { cadence, firstMonth, firstMonthSplitDay } = payPeriods;
  const periods = useMemo(
    () => buildPayPeriods({ cadence, firstMonth, firstMonthSplitDay }),
    [cadence, firstMonth, firstMonthSplitDay]
  );
  // Payouts happen the morning after a period closes, so for the first three
  // days of a new period the tab opens on the one that just ended.
  const defaultKey = useMemo(() => {
    const payPeriods = periods.filter((p) => p.kind === "period");
    const [current, previous] = payPeriods;
    const justStarted = current && easternDateString() <= addDaysToDateString(current.start, 2);
    return (justStarted && previous ? previous : current)?.key ?? periods[0]?.key ?? "";
  }, [periods]);
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const range: RangeState = {
    preset: "custom",
    customStart: period?.start,
    customEnd: period?.end,
  };
  const { data, error } = useSectionData<CommissionsResponse>(apiPath, range);

  const { mutate } = useSWRConfig();
  const refresh = () =>
    mutate((key) => typeof key === "string" && key.startsWith(apiPath));

  const today = easternDateString();
  const clawbackDate = period && today >= period.start && today <= period.end ? today : period?.end ?? today;
  const status = data ? payoutStatus(period?.end, data.portalSyncedAt) : null;

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

      {status ? (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border-2 p-4"
          style={{
            borderColor: `var(--cell-${status.tone}-bg)`,
            background: `var(--cell-${status.tone}-bg)`,
          }}
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{
              background:
                status.tone === "green" ? "#10b981" : status.tone === "yellow" ? "#f5be42" : "#ef4444",
            }}
            aria-hidden="true"
          />
          <div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">{status.title}</div>
            <div className="text-xs text-[var(--text-muted)]">{status.detail}</div>
          </div>
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
                apiPath={apiPath}
                rank={i + 1}
                rep={rep}
                lowTicket={data.lowTicket.find((r) => sameRep(r.rep, rep.rep))}
                deals={data.highTicketDeals.filter(
                  (d) => sameRep(d.closer, rep.rep) || sameRep(d.setter, rep.rep)
                )}
                clawbacks={data.clawbacks.filter((c) => sameRep(c.rep, rep.rep))}
                clawbackDate={clawbackDate}
                onChanged={refresh}
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
              {data && data.totals.clawbacks > 0 ? ` - clawbacks ${money(data.totals.clawbacks)}` : ""}
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
