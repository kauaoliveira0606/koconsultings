"use client";

import { Fragment, useState } from "react";
import useSWR from "swr";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatStatValue } from "@/lib/format";
import type { PaymentPlan, PaymentPlanStatus, PaymentPlansResponse } from "@/lib/payment-plans";

const REFRESH_MS = 60_000;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

const BADGE: Record<PaymentPlanStatus, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-500/20 text-red-300" },
  onTrack: { label: "On Track", className: "bg-emerald-500/20 text-emerald-300" },
  paidOff: { label: "Paid Off", className: "bg-[var(--panel-subtle)] text-[var(--text-muted)]" },
  churned: { label: "Churned", className: "bg-amber-500/20 text-amber-300" },
};

type Filter = PaymentPlanStatus | "active" | "deposit";

// Paid off and churned plans are off the list: they only show under their own filter.
const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "onTrack", label: "On Track" },
  { key: "deposit", label: "Deposits" },
  { key: "paidOff", label: "Paid Off" },
  { key: "churned", label: "Churned" },
];

const isActive = (plan: PaymentPlan) => plan.status === "overdue" || plan.status === "onTrack";

const matches = (plan: PaymentPlan, filter: Filter) =>
  filter === "active"
    ? isActive(plan)
    : filter === "deposit"
      ? isActive(plan) && plan.kind === "deposit"
      : plan.status === filter;

type PlanEdit = { amountOwed?: number; status?: "Active" | "Paid Off" | "Churned" };

const ACTION_BUTTON =
  "rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-40";

/** Hand edits for one plan: retype the balance, or take it off the list (paid in full / churned). */
function PlanActions({
  plan,
  onSave,
}: {
  plan: PaymentPlan;
  onSave: (plan: PaymentPlan, edit: PlanEdit) => Promise<boolean>;
}) {
  const [owed, setOwed] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const owedNumber = Number.parseFloat(owed.replace(/[^0-9.]/g, ""));
  const removed = plan.status === "paidOff" || plan.status === "churned";
  const name = plan.leadName ?? "this lead";

  async function save(edit: PlanEdit) {
    setBusy(true);
    setError(false);
    const ok = await onSave(plan, edit);
    setBusy(false);
    setError(!ok);
    if (ok) setOwed("");
  }

  if (removed) {
    return (
      <div>
        <div className="font-semibold uppercase tracking-wide">Update</div>
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ status: "Active" })}
          className={`mt-1 text-[var(--text-strong)] ${ACTION_BUTTON}`}
        >
          {busy ? "..." : "Put Back On The List"}
        </button>
        {error ? <div className="mt-1 text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</div> : null}
      </div>
    );
  }

  return (
    <div>
      <div className="font-semibold uppercase tracking-wide">Update</div>
      <form
        className="mt-1 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number.isFinite(owedNumber)) save({ amountOwed: owedNumber });
        }}
      >
        <input
          value={owed}
          onChange={(e) => setOwed(e.target.value)}
          placeholder="Still owes"
          inputMode="decimal"
          aria-label={`Amount ${name} still owes`}
          className="w-28 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
        />
        <button
          type="submit"
          disabled={busy || !Number.isFinite(owedNumber)}
          className="rounded-md bg-[var(--btn-active-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-active-fg)] disabled:opacity-40"
        >
          {busy ? "..." : "Save Balance"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Mark ${name} as paid in full and take them off the list?`)) {
              save({ status: "Paid Off" });
            }
          }}
          className={`text-emerald-400 ${ACTION_BUTTON}`}
        >
          Paid In Full
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Mark ${name} as churned and take them off the list?`)) {
              save({ status: "Churned" });
            }
          }}
          className={`text-red-400 ${ACTION_BUTTON}`}
        >
          Churned
        </button>
      </form>
      {plan.owedUpdatedOn ? (
        <div className="mt-1">Balance last set by hand on {day(plan.owedUpdatedOn)}.</div>
      ) : null}
      {error ? <div className="mt-1 text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</div> : null}
    </div>
  );
}

function day(ymd: string | null): string {
  if (!ymd) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

const money = (value: number | null) => formatStatValue(value, "currency");

function PlanRows({
  plan,
  onSave,
}: {
  plan: PaymentPlan;
  onSave: (plan: PaymentPlan, edit: PlanEdit) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const badge = BADGE[plan.status];
  const made = plan.payments.length;
  return (
    <Fragment>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-b border-[var(--panel-border)] hover:bg-[var(--panel-subtle)]"
      >
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-strong)]">
            {plan.leadName ?? "Unknown lead"}
            {plan.kind === "deposit" ? (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                Deposit
              </span>
            ) : null}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{plan.leadEmail ?? "No email logged"}</div>
        </td>
        <td className="px-4 py-3 text-[var(--text-muted)]">
          <div>{plan.closer ?? "—"}</div>
          <div className="text-xs">Set by {plan.setter ?? "—"}</div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">{day(plan.startDate)}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-strong)]">
            {plan.installments
              ? `${plan.installments} split pay${plan.installments === 1 ? "" : "s"}`
              : plan.kind === "deposit"
                ? "Deposit"
                : "—"}
          </div>
          <div className="max-w-[16rem] truncate text-xs text-[var(--text-muted)]">
            {plan.structure ?? "No structure logged"}
          </div>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <div className="text-emerald-400">{money(plan.paid)}</div>
          <div className="text-xs text-[var(--text-muted)]">
            {made} payment{made === 1 ? "" : "s"} of {money(plan.total)}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-[var(--text-strong)]">
          {money(plan.remaining)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div>{day(plan.nextDue)}</div>
          {plan.nextDue && !plan.nextDueLogged ? (
            <div className="text-xs text-[var(--text-muted)]">Assumed</div>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)]">
          <td colSpan={8} className="px-4 py-3 text-xs text-[var(--text-muted)]">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <div className="font-semibold uppercase tracking-wide">Payments logged</div>
                <ul className="mt-1 space-y-0.5">
                  {plan.payments.map((p, i) => (
                    <li key={i}>
                      {day(p.date)} · {money(p.amount)} ·{" "}
                      {p.kind === "first" ? "On the call" : "Follow up payment"}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 max-w-md">
                <div className="font-semibold uppercase tracking-wide">Details</div>
                <div className="mt-1 whitespace-pre-wrap">{plan.structure ?? "No structure logged"}</div>
                <div className="mt-1">
                  {[plan.offer, plan.collectedOn ? `Collected on ${plan.collectedOn}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {plan.timesLogged > 1 ? (
                  <div className="mt-1 text-amber-300">
                    Logged {plan.timesLogged} times in post call notes. Counted once.
                  </div>
                ) : null}
              </div>
              <PlanActions plan={plan} onSave={onSave} />
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

/**
 * Every deal closed on a payment plan (Post Call Note with Call Outcome =
 * Payment Plan) and where it stands: split pays, what has come in, what is
 * still owed and when the next payment should land. Opening a row lets the
 * balance be retyped, or the plan be taken off the list as paid in full or
 * churned.
 */
export function PaymentPlansBoard({ apiPath }: { apiPath: string }) {
  const { data, error, mutate } = useSWR<PaymentPlansResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [filter, setFilter] = useState<Filter>("active");

  const plans = data?.plans.filter((p) => matches(p, filter));

  async function savePlan(plan: PaymentPlan, edit: PlanEdit): Promise<boolean> {
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, lead: plan.leadName ?? "", ...edit }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div>
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Every post call note with Call Outcome set to Payment Plan or Deposit. Later payments count
        once they are logged on the Follow Up Payment form. Next payment is the date the closer put
        on the form; when there is none it is assumed one month out. Click a plan to update what they owe, or to take them off the list
        as paid in full or churned.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Plans"
          value={data?.summary.active}
          size="lg"
          subtext={
            data
              ? `Payment plans and deposits with a balance still owed. ${data.summary.deposits} ${data.summary.deposits === 1 ? "is a deposit" : "are deposits"}.`
              : undefined
          }
        />
        <StatCard
          label="Still Owed"
          value={data?.summary.outstanding}
          format="currency"
          size="lg"
          subtext="Total Revenue minus everything collected, across active plans."
        />
        <StatCard
          label="Overdue"
          value={data?.summary.overdueAmount}
          format="currency"
          size="lg"
          status={data && data.summary.overdue > 0 ? "red" : null}
          subtext={
            data
              ? `${data.summary.overdue} past their next payment date with no follow up payment logged.`
              : undefined
          }
        />
        <StatCard
          label="Collected On Plans"
          value={data?.summary.collected}
          format="currency"
          size="lg"
          subtext={
            data
              ? `Everything paid on a plan so far. ${data.summary.paidOff} paid off, ${data.summary.churned} churned (${formatStatValue(data.summary.churnedAmount, "currency")} never collected).`
              : undefined
          }
        />
      </div>

      <div className="mt-8 mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === f.key
                ? "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)]"
                : "border border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {f.label}
            {data ? ` (${data.plans.filter((p) => matches(p, f.key)).length})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Closer</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Split Pays</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Still Owed</th>
              <th className="px-4 py-3">Next Payment</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {plans?.map((plan) => <PlanRows key={plan.id} plan={plan} onSave={savePlan} />)}
          </tbody>
        </table>
        {!plans || plans.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)]">
            {error
              ? "Couldn't load payment plans, retrying..."
              : plans
                ? "No payment plans here yet."
                : "Loading..."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
