"use client";

import { Fragment, useState } from "react";
import useSWR from "swr";
import { StatCard } from "@/components/dashboard/StatCard";
import { easternDateString } from "@/lib/date-range";
import { formatStatValue } from "@/lib/format";
import { UPSELL_STATUSES, type UpsellStatus } from "@/lib/upsell-status";
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

const FILTER_BUTTON = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    active
      ? "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)]"
      : "border border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
  }`;

const Badge = ({ label, className }: { label: string; className: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
    {label}
  </span>
);

type StatusEdit = { status?: UpsellStatus; note?: string };
type SaveStatus = (
  customer: { key: string; name: string | null },
  edit: StatusEdit
) => Promise<boolean>;
type Workable = {
  key: string;
  name: string | null;
  status: UpsellStatus;
  statusNote: string | null;
  statusUpdated: string | null;
};

const STATUS_COLOR: Record<UpsellStatus, string> = {
  "Not Contacted": "text-[var(--text-muted)]",
  "No Pick Up": "text-orange-300",
  Pitched: "text-sky-300",
  "Call Booked": "text-emerald-300",
  Upsold: "text-purple-300",
  "Not Interested": "text-red-300",
  "Financial DQ": "text-amber-300",
};

/** Upsell status dropdown, saved the moment it changes. */
function StatusSelect({ customer, onSave }: { customer: Workable; onSave: SaveStatus }) {
  const [busy, setBusy] = useState(false);
  return (
    <select
      value={customer.status}
      disabled={busy}
      aria-label={`Upsell status for ${customer.name ?? "this customer"}`}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        setBusy(true);
        await onSave(customer, { status: e.target.value as UpsellStatus });
        setBusy(false);
      }}
      className={`rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-xs font-semibold disabled:opacity-40 ${STATUS_COLOR[customer.status]}`}
    >
      {UPSELL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/** Free-text note on where the upsell stands, shown in the opened row. */
function StatusNote({ customer, onSave }: { customer: Workable; onSave: SaveStatus }) {
  const [note, setNote] = useState(customer.statusNote ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  return (
    <form
      className="flex max-w-xl flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setState((await onSave(customer, { note })) ? "saved" : "error");
      }}
    >
      <input
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setState("idle");
        }}
        placeholder="Upsell note (what was said, when to follow up)"
        aria-label={`Upsell note for ${customer.name ?? "this customer"}`}
        className="min-w-0 flex-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
      />
      <button
        type="submit"
        disabled={state === "busy" || note.trim() === (customer.statusNote ?? "")}
        className="rounded-md bg-[var(--btn-active-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-active-fg)] disabled:opacity-40"
      >
        {state === "busy" ? "..." : "Save Note"}
      </button>
      {state === "error" ? <span className="text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</span> : null}
      {customer.statusUpdated ? <span>Last updated {day(customer.statusUpdated)}.</span> : null}
    </form>
  );
}

type StatusFilter = UpsellStatus | "all";

/** "Upsell status" filter row with a count on every status. */
function StatusFilterRow({
  customers,
  value,
  onChange,
}: {
  customers: Workable[] | undefined;
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Upsell Status
      </span>
      {(["all", ...UPSELL_STATUSES] as StatusFilter[]).map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className={FILTER_BUTTON(value === s)}>
          {s === "all" ? "All" : s}
          {customers ? ` (${customers.filter((c) => s === "all" || c.status === s).length})` : ""}
        </button>
      ))}
    </div>
  );
}

/**
 * Who is working their list: one row per rep with how many of their
 * customers sit in each upsell status. "Worked" is everyone moved off Not
 * Contacted. A customer with deals from two reps counts for both.
 */
function StatusRollup({
  title,
  repLabel,
  groups,
  selected,
  onSelect,
}: {
  title: string;
  repLabel: string;
  groups: { name: string; customers: Workable[] }[];
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  if (groups.length === 0) return null;
  const rows = [...groups].sort(
    (a, b) => b.customers.length - a.customers.length || a.name.localeCompare(b.name)
  );
  const worked = (list: Workable[]) => list.filter((c) => c.status !== "Not Contacted").length;
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">{repLabel}</th>
              <th className="px-4 py-3 text-right">Customers</th>
              <th className="px-4 py-3 text-right">Worked</th>
              {UPSELL_STATUSES.map((s) => (
                <th key={s} className="px-4 py-3 text-right whitespace-nowrap">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const done = worked(g.customers);
              return (
                <tr
                  key={g.name}
                  onClick={onSelect ? () => onSelect(g.name) : undefined}
                  className={`border-b border-[var(--panel-border)] last:border-0 ${
                    onSelect ? "cursor-pointer hover:bg-[var(--panel-subtle)]" : ""
                  } ${selected === g.name ? "bg-[var(--panel-subtle)]" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{g.name}</td>
                  <td className="px-4 py-3 text-right">{g.customers.length}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="font-semibold text-[var(--text-strong)]">{done}</span>
                    <span className="text-[var(--text-muted)]">
                      {" "}
                      ({Math.round((done / g.customers.length) * 100)}%)
                    </span>
                  </td>
                  {UPSELL_STATUSES.map((s) => {
                    const n = g.customers.filter((c) => c.status === s).length;
                    return (
                      <td
                        key={s}
                        className={`px-4 py-3 text-right ${n > 0 ? STATUS_COLOR[s] : "text-[var(--text-muted)] opacity-40"}`}
                      >
                        {n}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Financed deals (Clarity, Klarna, ...) change how the upsell call is run, so they stand out. */
const isFinanced = (paidVia: string) => /financ/i.test(paidVia);

const PaidVia = ({ method }: { method: string }) =>
  isFinanced(method) ? (
    <Badge label={method} className="bg-amber-500/20 text-amber-300" />
  ) : (
    <Badge label={method} className="bg-[var(--panel-subtle)] text-[var(--text-muted)]" />
  );

const paidViaOf = (customer: UpsellCustomer) => [
  ...new Set(customer.deals.flatMap((d) => (d.paidVia ? [d.paidVia] : []))),
];

const closersOf = (customer: UpsellCustomer) => [
  ...new Set(customer.deals.flatMap((d) => (d.closer ? [d.closer] : []))),
];

function CustomerRows({
  customer,
  today,
  onSave,
}: {
  customer: UpsellCustomer;
  today: string;
  onSave: SaveStatus;
}) {
  const [open, setOpen] = useState(false);
  const latest = customer.deals[0];
  const types = [...new Set(customer.deals.map((d) => d.type))];
  const methods = paidViaOf(customer);
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
          <StatusSelect customer={customer} onSave={onSave} />
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
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {methods.length > 0 ? methods.map((m) => <PaidVia key={m} method={m} />) : "—"}
          </div>
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
          <td colSpan={9} className="px-4 py-3 text-xs text-[var(--text-muted)]">
            <div className="space-y-3">
              <StatusNote customer={customer} onSave={onSave} />
              {customer.deals.map((d) => (
                <div key={d.id}>
                  <div className="font-semibold text-[var(--text-strong)]">
                    {[day(d.date), TYPE_BADGE[d.type].label, d.offer, d.typeOfClose]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div>
                    {money(d.cash)} collected on the call of a {money(d.revenue)} deal
                    {d.paidVia ? `, paid via ${d.paidVia}` : ""} · Closed by {d.closer ?? "—"}, set by{" "}
                    {d.setter ?? "—"}
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

type ListProps = {
  data: UpsellPotentialResponse | undefined;
  error: unknown;
  today: string;
  onSave: SaveStatus;
};

type CallFilter = "callList" | "all" | "noCall" | "booked";

// The call list is who a setter should ring next: bought the software, no
// high ticket call booked, and either untouched or tried with no answer.
const CALL_FILTERS: { key: CallFilter; label: string }[] = [
  { key: "callList", label: "Call List" },
  { key: "all", label: "All" },
  { key: "noCall", label: "No Call Booked" },
  { key: "booked", label: "Call Booked" },
];

const callMatches = (customer: LowTicketCustomer, filter: CallFilter) =>
  filter === "all"
    ? true
    : filter === "callList"
      ? !customer.bookedCall &&
        (customer.status === "Not Contacted" || customer.status === "No Pick Up")
      : (filter === "booked") === customer.bookedCall;

const repsOf = (customer: LowTicketCustomer) => [
  ...new Set(customer.sales.flatMap((s) => (s.rep ? [s.rep] : []))),
];

const product = (sale: { software: string | null; plan: string | null }) =>
  [sale.software, sale.plan].filter(Boolean).join(" ") || "—";

function LowTicketRows({
  customer,
  today,
  onSave,
}: {
  customer: LowTicketCustomer;
  today: string;
  onSave: SaveStatus;
}) {
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
          <StatusSelect customer={customer} onSave={onSave} />
        </td>
        <td className="px-4 py-3">
          <div className="text-[var(--text-strong)]">
            {products.join(", ")}
            {customer.yearly ? (
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                Yearly
              </span>
            ) : null}
          </div>
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
          <td colSpan={7} className="px-4 py-3 text-xs text-[var(--text-muted)]">
            <div className="mb-3">
              <StatusNote customer={customer} onSave={onSave} />
            </div>
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
function LowTicketList({ data, error, today, onSave }: ListProps) {
  const [filter, setFilter] = useState<CallFilter>("callList");
  const [plan, setPlan] = useState<"all" | "yearly" | "monthly">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const low = data?.lowTicket;
  const inView = low?.customers.filter(
    (c) => callMatches(c, filter) && (plan === "all" || (plan === "yearly") === c.yearly)
  );
  const customers = inView?.filter((c) => status === "all" || c.status === status);
  // On the call list, people nobody has tried yet come before the no pick ups, and yearly
  // buyers go first within each; the newest purchase leads within each group.
  if (filter === "callList") {
    customers?.sort(
      (a, b) =>
        Number(a.status === "No Pick Up") - Number(b.status === "No Pick Up") ||
        Number(b.yearly) - Number(a.yearly)
    );
  }

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Everyone in the Affiliate PCN who has not bought high ticket. One row per customer, newest
        first. The Call List is who to ring next: no high ticket call booked and either not
        contacted yet or no pick up, yearly plan buyers first. Anyone who bought both only shows under High Ticket. The same sale entered twice
        (same email, name and software) counts once, keeping the latest entry.
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
          subtext={
            low
              ? `CPA logged on the Affiliate PCN for these customers. ${low.summary.duplicatesRemoved} duplicate entr${low.summary.duplicatesRemoved === 1 ? "y" : "ies"} left out.`
              : undefined
          }
        />
      </div>

      <StatusRollup
        title="Upsell Status By Rep"
        repLabel="Sold By"
        groups={[...new Set(low?.customers.flatMap(repsOf) ?? [])].map((name) => ({
          name,
          customers: low?.customers.filter((c) => repsOf(c).includes(name)) ?? [],
        }))}
      />

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
        <span className="mx-1 self-center text-[var(--text-muted)]">|</span>
        {(["all", "yearly", "monthly"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPlan(p)} className={FILTER_BUTTON(plan === p)}>
            {p === "all" ? "All Plans" : p === "yearly" ? "Yearly" : "Monthly"}
          </button>
        ))}
      </div>
      <StatusFilterRow customers={inView} value={status} onChange={setStatus} />

      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Upsell Status</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Sold By</th>
              <th className="px-4 py-3">Last Purchase</th>
              <th className="px-4 py-3">High Ticket Call</th>
              <th className="px-4 py-3 text-right">Cash Collected</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <LowTicketRows key={c.id} customer={c} today={today} onSave={onSave} />
            ))}
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
function HighTicketList({ data, error, today, onSave }: ListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [closer, setCloser] = useState<string | null>(null);

  // Closers ranked by how many customers they closed. A customer with deals
  // from two closers counts for both.
  const closers = [...new Set(data?.customers.flatMap(closersOf) ?? [])]
    .map((name) => ({
      name,
      count: data?.customers.filter((c) => closersOf(c).includes(name)).length ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const selected = closers.some((c) => c.name === closer) ? closer : null;

  // Everything below (cards, counts, table) follows the selected closer.
  const mine = data?.customers.filter((c) => selected === null || closersOf(c).includes(selected));
  const inView = mine?.filter((c) => matches(c, filter));
  const customers = inView?.filter((c) => status === "all" || c.status === status);
  const count = (type: DealType) => mine?.filter((c) => matches(c, type)).length ?? 0;
  const cashCollected = mine?.reduce((t, c) => t + c.cashCollected, 0);
  const dealValue = mine?.reduce((t, c) => t + c.dealValue, 0);
  const financed = mine?.filter((c) => paidViaOf(c).some(isFinanced)).length;

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Every closed deal from the post call notes: deposits, payment plans and paid in full. One row
        per customer, newest first. Click a customer for their deals, the closer&apos;s notes and the
        call recording.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Closer
        </span>
        <button type="button" onClick={() => setCloser(null)} className={FILTER_BUTTON(selected === null)}>
          All{data ? ` (${data.customers.length})` : ""}
        </button>
        {closers.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setCloser(c.name)}
            className={FILTER_BUTTON(selected === c.name)}
          >
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={selected ? `${selected}'s Customers` : "Customers"}
          value={mine?.length}
          size="lg"
          subtext={
            mine
              ? `${count("closed")} closed, ${count("paymentPlan")} on a payment plan, ${count("deposit")} deposit${count("deposit") === 1 ? "" : "s"}.`
              : undefined
          }
        />
        <StatCard
          label="Cash Collected"
          value={cashCollected}
          format="currency"
          size="lg"
          subtext="Collected on the calls plus follow up payments logged for these customers."
        />
        <StatCard
          label="Deal Value"
          value={dealValue}
          format="currency"
          size="lg"
          subtext={
            mine && mine.length > 0 && dealValue !== undefined
              ? `Total Revenue across these deals. ${formatStatValue(dealValue / mine.length, "currency")} per customer.`
              : "Total Revenue across these deals."
          }
        />
        <StatCard
          label="Financed"
          value={financed}
          size="lg"
          subtext="Customers who paid through a financing partner (Clarity, Klarna, ...). Run these calls differently."
        />
      </div>

      <StatusRollup
        title="Upsell Status By Closer"
        repLabel="Closer"
        groups={closers.map((c) => ({
          name: c.name,
          customers: data?.customers.filter((x) => closersOf(x).includes(c.name)) ?? [],
        }))}
        selected={selected}
        onSelect={(name) => setCloser(selected === name ? null : name)}
      />

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
            {mine ? ` (${mine.filter((c) => matches(c, f.key)).length})` : ""}
          </button>
        ))}
      </div>
      <StatusFilterRow customers={inView} value={status} onChange={setStatus} />

      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Upsell Status</th>
              <th className="px-4 py-3">Deal Type</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Closer</th>
              <th className="px-4 py-3">Paid Via</th>
              <th className="px-4 py-3">Last Purchase</th>
              <th className="px-4 py-3 text-right">Cash Collected</th>
              <th className="px-4 py-3 text-right">Deal Value</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <CustomerRows key={c.id} customer={c} today={today} onSave={onSave} />
            ))}
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
  const { data, error, mutate } = useSWR<UpsellPotentialResponse>(apiPath, fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [ticket, setTicket] = useState<"high" | "low">("high");

  const saveStatus: SaveStatus = async (customer, edit) => {
    try {
      const res = await fetch(`${apiPath}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: customer.key, customer: customer.name ?? "", ...edit }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      return true;
    } catch {
      return false;
    }
  };
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
        <HighTicketList data={data} error={error} today={today} onSave={saveStatus} />
      ) : (
        <LowTicketList data={data} error={error} today={today} onSave={saveStatus} />
      )}
    </div>
  );
}
