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
  HighTicketRepRow,
  LowTicketRepRow,
} from "@/lib/airtable/commissions";

const money = (value: number | null | undefined) => formatStatValue(value, "currency");
// One decimal when the rate needs it (2.5%, 17.5%), none when it doesn't (10%).
const pct = (rate: number | undefined) => (rate === undefined ? "" : `${+(rate * 100).toFixed(1)}%`);
const sameRep = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.toLowerCase();

function formatDay(date: string | null): string {
  if (!date) return "Unknown";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One line of a rep's math: what it is, how it was worked out, what it pays.
 * `notPaid` lines are there for comparison and don't count toward the total.
 */
function MathLine({
  label,
  math,
  amount,
  notPaid,
}: {
  label: string;
  math: string;
  amount: number;
  notPaid?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text-strong)]">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{math}</div>
      </div>
      <div
        className={`text-sm font-semibold ${notPaid ? "text-[var(--text-muted)]" : "text-[var(--text-strong)]"}`}
      >
        {notPaid ? `(${money(amount)})` : money(amount)}
      </div>
    </div>
  );
}

/** Heading for one role's lines inside a rep card, with what that role pays. */
function RoleHeading({ title, amount }: { title: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 pt-4 pb-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </div>
      <div className="text-xs font-semibold text-[var(--text-muted)]">{money(amount)}</div>
    </div>
  );
}

/** "$5,000 via Whop - 2.5% processing - 15% financing = $4,125 x 10%" */
function dealMath(deal: HighTicketDeal, rate: number, rates: CommissionsResponse["rates"]): string {
  return (
    `${formatDay(deal.date)} · ${money(deal.cashCollected)}` +
    ` via ${deal.paymentMethod ?? "payment method not logged"}` +
    ` - ${pct(rates.highTicketProcessingFee)} processing` +
    (deal.financed ? ` - ${pct(rates.highTicketFinancingFee)} financing` : "") +
    ` = ${money(deal.netCash)} x ${pct(rate)}`
  );
}

const dealLabel = (deal: HighTicketDeal) =>
  `${deal.kind === "follow_up" ? "Follow Up Payment · " : ""}${deal.lead ?? "Unknown lead"}`;

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
  const closed = deals.filter((d) => sameRep(d.closer, rep.rep));
  const set = deals.filter((d) => sameRep(d.setter, rep.rep));
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

      <div className="mt-4 border-t border-[var(--panel-border)]">
        {lowTicket ? (
          <>
            <RoleHeading title={`Low Ticket (Affiliate) · ${pct(rates.lowTicket)}, no fees`} amount={rep.lowTicket} />
            <div className="divide-y divide-[var(--panel-border)]">
              <MathLine
                label="By Affiliate PCN (what they logged)"
                math={
                  `${lowTicket.submittedSales} sales · ${money(lowTicket.submittedCash)} logged x ${pct(rates.lowTicket)}` +
                  " · for comparison, not paid"
                }
                amount={lowTicket.submittedCommission}
                notPaid
              />
              <MathLine
                label="By attribution (what actually tracked, this is what pays)"
                math={
                  `${lowTicket.realSales} sales · ${money(lowTicket.realCash)} attributed x ${pct(rates.lowTicket)}` +
                  ` · attribution rate ${formatStatValue(lowTicket.attributionRate, "percent")}` +
                  ` (${lowTicket.trackedSales} tracked / ${lowTicket.submittedSales} logged)`
                }
                amount={lowTicket.commission}
              />
            </div>
          </>
        ) : null}

        {closed.length > 0 ? (
          <>
            <RoleHeading
              title={`Closer · ${pct(rates.highTicketCloser)} after fees`}
              amount={rep.highTicketCloser}
            />
            <div className="divide-y divide-[var(--panel-border)]">
              {closed.map((deal) => (
                <MathLine
                  key={deal.id}
                  label={dealLabel(deal)}
                  math={dealMath(deal, rates.highTicketCloser, rates)}
                  amount={deal.closerCommission}
                />
              ))}
            </div>
          </>
        ) : null}

        {set.length > 0 ? (
          <>
            <RoleHeading
              title={`Setter · ${pct(rates.highTicketSetter)} after fees`}
              amount={rep.highTicketSetter}
            />
            <div className="divide-y divide-[var(--panel-border)]">
              {set.map((deal) => (
                <MathLine
                  key={deal.id}
                  label={dealLabel(deal)}
                  math={dealMath(deal, rates.highTicketSetter, rates)}
                  amount={deal.setterCommission}
                />
              ))}
            </div>
          </>
        ) : null}

        {clawbacks.length > 0 ? (
          <>
            <RoleHeading title="Clawbacks" amount={-rep.clawbacks} />
            <div className="divide-y divide-[var(--panel-border)]">
              {clawbacks.map((c) => (
                <ClawbackLine key={c.id} apiPath={apiPath} clawback={c} onRemoved={onChanged} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <AddClawback apiPath={apiPath} rep={rep.rep} date={clawbackDate} onSaved={onChanged} />
    </div>
  );
}

const th = "py-2 pr-3 text-xs font-semibold uppercase tracking-wide last:pr-0";
const td = "py-2 pr-3 text-sm text-[var(--text-strong)] last:pr-0";

/** One department's reps side by side: a titled table with its total. */
function DepartmentTable({
  title,
  note,
  total,
  columns,
  rows,
}: {
  title: string;
  note: string;
  total: number;
  columns: string[];
  /** Rep name first, then one cell per column. */
  rows: { rep: string; cells: string[] }[];
}) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-base font-bold text-[var(--text-strong)]">{title}</div>
        <div className="text-xl font-bold text-[var(--text-strong)]">{money(total)}</div>
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">{note}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">Nothing in this pay period.</div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--panel-border)] text-[var(--text-muted)]">
                <th className={`${th} text-left`}>Rep</th>
                {columns.map((c) => (
                  <th key={c} className={`${th} text-right`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rep} className="border-b border-[var(--panel-border)] last:border-0">
                  <td className={`${td} text-left font-medium`}>{row.rep}</td>
                  {row.cells.map((cell, i) => (
                    <td key={columns[i]} className={`${td} text-right ${i === row.cells.length - 1 ? "font-semibold" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The same commissions as the rep cards, grouped by department instead of by person. */
function Departments({ data }: { data: CommissionsResponse }) {
  const { rates, totals } = data;
  const highTicketRole = (
    deals: (r: HighTicketRepRow) => number,
    cash: (r: HighTicketRepRow) => number,
    net: (r: HighTicketRepRow) => number,
    commission: (r: HighTicketRepRow) => number
  ) =>
    data.highTicket
      .filter((r) => deals(r) > 0)
      .sort((a, b) => commission(b) - commission(a))
      .map((r) => ({
        rep: r.rep,
        cells: [
          String(deals(r)),
          money(cash(r)),
          money(cash(r) - net(r)),
          money(net(r)),
          money(commission(r)),
        ],
      }));
  const highTicketColumns = ["Deals", "Cash", "Fees", "After Fees", "Commission"];
  const totalFees = totals.highTicketProcessingFees + totals.highTicketFinancingFees;

  return (
    <>
      <h3 className="mt-6 text-lg font-bold text-[var(--text-strong)]">By Department</h3>

      <DepartmentTable
        title="Affiliates (Low Ticket)"
        note={
          `Flat ${pct(rates.lowTicket)} of the cash, every day of the week, no fees. ` +
          `Logged is what each rep entered in Affiliate PCN. Attributed is what the affiliate portal ` +
          `actually tracked under their link, and it is what pays. ` +
          `By Affiliate PCN the team would be at ${money(totals.lowTicketSubmittedCommission)}.`
        }
        total={totals.lowTicketCommission}
        columns={["Logged (PCN)", `${pct(rates.lowTicket)} Of Logged`, "Attribution Rate", "Attributed", "Commission"]}
        rows={data.lowTicket.map((r) => ({
          rep: r.rep,
          cells: [
            `${money(r.submittedCash)} · ${r.submittedSales}`,
            money(r.submittedCommission),
            `${formatStatValue(r.attributionRate, "percent")} (${r.trackedSales}/${r.submittedSales})`,
            `${money(r.realCash)} · ${r.realSales}`,
            money(r.commission),
          ],
        }))}
      />

      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-base font-bold text-[var(--text-strong)]">High Ticket Fees</div>
          <div className="text-xl font-bold text-[var(--text-strong)]">{money(totalFees)}</div>
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Come off every high ticket deal before anyone is paid: the closer, the setter and your
          agency split are all worked out on the cash after fees. A deal counts as financed when
          the post call note says the payment was collected through financing.
        </div>
        <div className="mt-2 divide-y divide-[var(--panel-border)]">
          <MathLine
            label={`Processing · ${pct(rates.highTicketProcessingFee)} of every deal`}
            math={`${money(totals.highTicketCash)} high ticket cash x ${pct(rates.highTicketProcessingFee)}`}
            amount={totals.highTicketProcessingFees}
          />
          <MathLine
            label={`Financing · ${pct(rates.highTicketFinancingFee)} more on financed deals (${pct(rates.highTicketProcessingFee + rates.highTicketFinancingFee)} in total)`}
            math={`${money(totals.highTicketFinancedCash)} financed x ${pct(rates.highTicketFinancingFee)}`}
            amount={totals.highTicketFinancingFees}
          />
          <MathLine
            label="High ticket cash after fees"
            math={`${money(totals.highTicketCash)} - ${money(totalFees)}`}
            amount={totals.highTicketNetCash}
          />
        </div>
      </div>

      <DepartmentTable
        title="Closers (High Ticket)"
        note={`Flat ${pct(rates.highTicketCloser)} of each deal's cash after fees, from the post call notes and follow up payments.`}
        total={totals.highTicketCloserCommission}
        columns={highTicketColumns}
        rows={highTicketRole(
          (r) => r.closedDeals,
          (r) => r.closedCash,
          (r) => r.closedNetCash,
          (r) => r.closerCommission
        )}
      />

      <DepartmentTable
        title="Setters (High Ticket)"
        note={`Flat ${pct(rates.highTicketSetter)} of each deal's cash after fees, for the setter named on the post call note.`}
        total={totals.highTicketSetterCommission}
        columns={highTicketColumns}
        rows={highTicketRole(
          (r) => r.setDeals,
          (r) => r.setCash,
          (r) => r.setNetCash,
          (r) => r.setterCommission
        )}
      />
    </>
  );
}

/**
 * An offer's Commissions tab: reps ranked by what they are owed with the
 * math under each, the total to pay out, then the same commissions by
 * department (affiliates, closers, setters) with the high ticket fees. `apiPath` is the offer's commissions
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
        <h2 className="text-2xl font-bold">Commissions</h2>
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
              Low ticket {money(data?.totals.lowTicketCommission)} + closers{" "}
              {money(data?.totals.highTicketCloserCommission)} + setters{" "}
              {money(data?.totals.highTicketSetterCommission)}
              {data && data.totals.clawbacks > 0 ? ` - clawbacks ${money(data.totals.clawbacks)}` : ""}
            </div>
          </div>
          <div className="text-4xl font-bold text-[var(--text-strong)]">
            {money(data?.totals.commission)}
          </div>
        </div>

        {data ? <Departments data={data} /> : null}
      </div>
    </div>
  );
}
