"use client";

import { Fragment, useState } from "react";
import useSWR from "swr";
import { StatCard } from "@/components/dashboard/StatCard";
import { easternDateString } from "@/lib/date-range";
import { formatStatValue } from "@/lib/format";
import type {
  DealType,
  LowTicketCustomer,
  UpsellCustomer,
  UpsellPotentialResponse,
} from "@/lib/upsell-potential";

const REFRESH_MS = 60_000;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

const TYPE_BADGE: Record<DealType, { label: string; className: string }> = {
  closed: { label: "Closed", className: "bg-emerald-500/20 text-emerald-300" },
  paymentPlan: { label: "Payment Plan", className: "bg-sky-500/20 text-sky-300" },
  deposit: { label: "Deposit", className: "bg-amber-500/20 text-amber-300" },
};

type Filter = DealType | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "closed", label: "Closed" },
  { key: "paymentPlan", label: "Payment Plans" },
  { key: "deposit", label: "Deposits" },
];

const matches = (customer: UpsellCustomer, filter: Filter) =>
  filter === "all" || customer.deals.some((d) => d.type === filter);

function day(ymd: string | null): string {
  if (!ymd) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

function daysAgo(ymd: string | null, today: string): string | null {
  if (!ymd) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const money = (value: number | null) => formatStatValue(value, "currency");

const Badge = ({ label, className }: { label: string; className: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
    {label}
  </span>
);

function CustomerRows({ customer, today }: { customer: UpsellCustomer; today: string }) {
  const [open, setOpen] = useState(false);
  const latest = customer.deals[0];
  const types = [...new Set(customer.deals.map((d) => d.type))];
  return (
    <Fragment>
      <tr
        onClick={() => setOpen((o) => !o)}
        className={`cursor-pointer border-b border-[var(--panel-border)] hover:bg-[var(--panel-subtle)] ${customer.churned ? "opacity-60" : ""}`}
      >
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-strong)]">{customer.name ?? "Unknown lead"}</div>
          <div className="text-xs text-[var(--text-muted)]">{customer.email ?? "No email logged"}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <Badge key={t} {...TYPE_BADGE[t]} />
            ))}
            {customer.upsold ? <Badge label="Upsold" className="bg-purple-500/20 text-purple-300" /> : null}
            {customer.churned ? <Badge label="Churned" className="bg-red-500/20 text-red-300" /> : null}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-[var(--text-strong)]">{latest?.offer ?? "—"}</div>
          {customer.deals.length > 1 ? (
            <div className="text-xs text-[var(--text-muted)]">{customer.deals.length} deals</div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-[var(--text-muted)]">
          <div>{latest?.closer ?? "—"}</div>
          <div className="text-xs">Set by {latest?.setter ?? "—"}</div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div>{day(customer.lastPurchase)}</div>
          <div className="text-xs text-[var(--text-muted)]">{daysAgo(customer.lastPurchase, today)}</div>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap text-emerald-400">
          {money(customer.cashCollected)}
        </td>
        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-[var(--text-strong)]">
          {money(customer.dealValue)}
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)]">
          <td colSpan={7} className="px-4 py-3 text-xs text-[var(--text-muted)]">
            <div className="space-y-3">
              {customer.deals.map((d) => (
                <div key={d.id}>
                  <div className="font-semibold text-[var(--text-strong)]">
                    {[day(d.date), TYPE_BADGE[d.type].label, d.offer, d.typeOfClose]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div>
                    {money(d.cash)} collected on the call of a {money(d.revenue)} deal · Closed by{" "}
                    {d.closer ?? "—"}, set by {d.setter ?? "—"}
                  </div>
                  {d.notes ? <div className="mt-1 max-w-3xl whitespace-pre-wrap">{d.notes}</div> : null}
                  {d.fathomLink?.startsWith("http") ? (
                    <a
                      href={d.fathomLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-block text-[var(--text-strong)] underline"
                    >
                      Call recording
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

type ListProps = { data: UpsellPotentialResponse | undefined; error: unknown; today: string };

const FILTER_BUTTON = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    active
      ? "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)]"
      : "border border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
  }`;

type CallFilter = "all" | "noCall" | "booked";

const CALL_FILTERS: { key: CallFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "noCall", label: "No Call Booked" },
  { key: "booked", label: "Call Booked" },
];

const callMatches = (customer: LowTicketCustomer, filter: CallFilter) =>
  filter === "all" || (filter === "booked") === customer.bookedCall;

const product = (sale: { software: string | null; plan: string | null }) =>
  [sale.software, sale.plan].filter(Boolean).join(" ") || "—";

function LowTicketRows({ customer, today }: { customer: LowTicketCustomer; today: string }) {
  const [open, setOpen] = useState(false);
  const latest = customer.sales[0];
  const products = [...new Set(customer.sales.map(product))];
  return (
    <Fragment>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-b border-[var(--panel-border)] hover:bg-[var(--panel-subtle)]"
      >
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-strong)]">{customer.name ?? "Unknown lead"}</div>
          <div className="text-xs text-[var(--text-muted)]">{customer.email ?? "No email logged"}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-[var(--text-strong)]">{products.join(", ")}</div>
          {customer.sales.length > 1 ? (
            <div className="text-xs text-[var(--text-muted)]">{customer.sales.length} sales</div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-[var(--text-muted)]">{latest?.rep ?? "—"}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div>{day(customer.lastPurchase)}</div>
          <div className="text-xs text-[var(--text-muted)]">{daysAgo(customer.lastPurchase, today)}</div>
        </td>
        <td className="px-4 py-3">
          {customer.bookedCall ? (
            <Badge label="Call Booked" className="bg-emerald-500/20 text-emerald-300" />
          ) : (
            <Badge label="No Call Booked" className="bg-[var(--panel-subtle)] text-[var(--text-muted)]" />
          )}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap text-emerald-400">
          {money(customer.cashCollected)}
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--panel-border)] bg-[var(--panel-subtle)]">
          <td colSpan={6} className="px-4 py-3 text-xs text-[var(--text-muted)]">
            <ul className="space-y-1">
              {customer.sales.map((s) => (
                <li key={s.id}>
                  {[day(s.date), product(s), money(s.cash), `Sold by ${s.rep ?? "—"}`].join(" · ")}
                  {s.bookedCall ? " · High ticket call booked" : ""}
                  {s.fathomLink?.startsWith("http") ? (
                    <>
                      {" · "}
                      <a
                        href={s.fathomLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--text-strong)] underline"
                      >
                        Call recording
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

/** Low ticket customers: everyone in the Affiliate PCN who has not bought high ticket. */
function LowTicketList({ data, error, today }: ListProps) {
  const [filter, setFilter] = useState<CallFilter>("all");
  const low = data?.lowTicket;
  const customers = low?.customers.filter((c) => callMatches(c, filter));

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Everyone in the Affiliate PCN who has not bought high ticket. One row per customer, newest
        first. Anyone who bought both only shows under High Ticket.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Low Ticket Customers"
          value={low?.summary.customers}
          size="lg"
          subtext={
            low
              ? `${low.summary.alsoHighTicket} more bought high ticket too and sit on that list.`
              : undefined
          }
        />
        <StatCard
          label="No Call Booked"
          value={low?.summary.noCall}
          size="lg"
          subtext="Bought the software with no high ticket call booked on the sale."
        />
        <StatCard
          label="Call Booked"
          value={low?.summary.bookedCall}
          size="lg"
          subtext="Logged with a high ticket call booked, not closed on high ticket yet."
        />
        <StatCard
          label="Cash Collected"
          value={low?.summary.cashCollected}
          format="currency"
          size="lg"
          subtext="CPA logged on the Affiliate PCN for these customers."
        />
      </div>

      <div className="mt-8 mb-3 flex flex-wrap gap-2">
        {CALL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={FILTER_BUTTON(filter === f.key)}
          >
            {f.label}
            {low ? ` (${low.customers.filter((c) => callMatches(c, f.key)).length})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Sold By</th>
              <th className="px-4 py-3">Last Purchase</th>
              <th className="px-4 py-3">High Ticket Call</th>
              <th className="px-4 py-3 text-right">Cash Collected</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => <LowTicketRows key={c.id} customer={c} today={today} />)}
          </tbody>
        </table>
        {!customers || customers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)]">
            {error
              ? "Couldn't load customers, retrying..."
              : customers
                ? "No low ticket customers here yet."
                : "Loading..."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** High ticket customers: Post Call Note with Call Outcome = Deposit, Payment Plan or Closed. */
function HighTicketList({ data, error, today }: ListProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const customers = data?.customers.filter((c) => matches(c, filter));

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Every closed deal from the post call notes: deposits, payment plans and paid in full. One row
        per customer, newest first. Click a customer for their deals, the closer&apos;s notes and the
        call recording.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Customers"
          value={data?.summary.customers}
          size="lg"
          subtext={
            data
              ? `${data.summary.closed} closed, ${data.summary.paymentPlans} on a payment plan, ${data.summary.deposits} deposit${data.summary.deposits === 1 ? "" : "s"}.`
              : undefined
          }
        />
        <StatCard
          label="Cash Collected"
          value={data?.summary.cashCollected}
          format="currency"
          size="lg"
          subtext="Collected on the calls plus follow up payments logged for these customers."
        />
        <StatCard
          label="Deal Value"
          value={data?.summary.dealValue}
          format="currency"
          size="lg"
          subtext="Total Revenue across every closed deal."
        />
        <StatCard
          label="Average Deal"
          value={data && data.summary.customers > 0 ? data.summary.dealValue / data.summary.customers : null}
          format="currency"
          size="lg"
          subtext="Deal Value divided by customers."
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
            {data ? ` (${data.customers.filter((c) => matches(c, f.key)).length})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Deal Type</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Closer</th>
              <th className="px-4 py-3">Last Purchase</th>
              <th className="px-4 py-3 text-right">Cash Collected</th>
              <th className="px-4 py-3 text-right">Deal Value</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => <CustomerRows key={c.id} customer={c} today={today} />)}
          </tbody>
        </table>
        {!customers || customers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)]">
            {error
              ? "Couldn't load customers, retrying..."
              : customers
                ? "No closed deals here yet."
                : "Loading..."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Everyone who has bought, split into High Ticket (post call notes) and Low
 * Ticket (Affiliate PCN). Nobody is on both: buying high ticket takes a
 * customer off the low ticket list.
 */
export function UpsellPotentialBoard({ apiPath }: { apiPath: string }) {
  const { data, error } = useSWR<UpsellPotentialResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [ticket, setTicket] = useState<"high" | "low">("high");
  const today = easternDateString();
  const tabs = [
    { key: "high" as const, label: "High Ticket", count: data?.summary.customers },
    { key: "low" as const, label: "Low Ticket", count: data?.lowTicket.summary.customers },
  ];

  return (
    <div>
      <div className="-mt-2 mb-4 inline-flex rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTicket(t.key)}
            aria-pressed={ticket === t.key}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
              ticket === t.key
                ? "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>
      {ticket === "high" ? (
        <HighTicketList data={data} error={error} today={today} />
      ) : (
        <LowTicketList data={data} error={error} today={today} />
      )}
    </div>
  );
}
