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
};

const FILTERS: { key: PaymentPlanStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "onTrack", label: "On Track" },
  { key: "paidOff", label: "Paid Off" },
];

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

function PlanRows({ plan }: { plan: PaymentPlan }) {
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
          <div className="font-medium text-[var(--text-strong)]">{plan.leadName ?? "Unknown lead"}</div>
          <div className="text-xs text-[var(--text-muted)]">{plan.leadEmail ?? "No email logged"}</div>
        </td>
        <td className="px-4 py-3 text-[var(--text-muted)]">
          <div>{plan.closer ?? "—"}</div>
          <div className="text-xs">Set by {plan.setter ?? "—"}</div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">{day(plan.startDate)}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-strong)]">
            {plan.installments ? `${plan.installments} split pay${plan.installments === 1 ? "" : "s"}` : "—"}
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
        <td className="px-4 py-3 whitespace-nowrap">{day(plan.nextDue)}</td>
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
 * still owed and when the next payment should land.
 */
export function PaymentPlansBoard({ apiPath }: { apiPath: string }) {
  const { data, error } = useSWR<PaymentPlansResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [filter, setFilter] = useState<PaymentPlanStatus | "all">("all");

  const plans = data?.plans.filter((p) => filter === "all" || p.status === filter);

  return (
    <div>
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Every post call note with Call Outcome set to Payment Plan. Later installments count once
        they are logged on the Follow Up Payment form. Next payment assumes one payment a month from
        the day the plan started.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Plans"
          value={data?.summary.active}
          size="lg"
          subtext="Payment plans with a balance still owed."
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
              ? `${data.summary.overdue} plan${data.summary.overdue === 1 ? "" : "s"} past the next monthly payment with no follow up payment logged.`
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
              ? `First payments plus follow up payments. ${data.summary.paidOff} plan${data.summary.paidOff === 1 ? "" : "s"} paid off.`
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
            {data ? ` (${f.key === "all" ? data.plans.length : data.plans.filter((p) => p.status === f.key).length})` : ""}
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
            {plans?.map((plan) => <PlanRows key={plan.id} plan={plan} />)}
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
