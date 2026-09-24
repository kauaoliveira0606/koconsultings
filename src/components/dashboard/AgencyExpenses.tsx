"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { formatStatValue } from "@/lib/format";

type Expense = { id: string; tool: string; cost: number; month: string };
type ExpensesResponse = { bronson: Expense[]; ecomSimulation: Expense[] };
type Offer = keyof ExpensesResponse;

const OFFERS: { key: Offer; label: string; dot: string; note: string }[] = [
  { key: "bronson", label: "Bronson", dot: "#f97316", note: "Comes off paid profit before your 50%." },
  {
    key: "ecomSimulation",
    label: "Andy (Ecom Simulation)",
    dot: "#22d3ee",
    note: "Split 50/50 off organic and paid profit before your split.",
  },
];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed (${res.status})`);
  return res.json();
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const sum = (list: Expense[] | undefined) => (list ?? []).reduce((t, e) => t + e.cost, 0);

/**
 * Monthly tool expenses per offer (Bronson + Andy only — Aval has none),
 * written straight on the page. Each bill counts in full for its month and
 * comes off profit before the profit split, so saving one refreshes every
 * number on the Agency page.
 */
export function AgencyExpenses() {
  const [month, setMonth] = useState(currentMonth);
  const key = `/api/agency/expenses?month=${month}`;
  const { data } = useSWR<ExpensesResponse>(key, fetcher);
  const { mutate } = useSWRConfig();

  const refreshAll = () =>
    mutate((k) => typeof k === "string" && k.startsWith("/api/agency/"));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Expenses
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="min-w-[9rem] text-center font-medium text-[var(--text-strong)]">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md border border-[var(--panel-border)] px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {OFFERS.map((offer) => (
          <OfferExpenses
            key={offer.key}
            offer={offer}
            month={month}
            expenses={data?.[offer.key]}
            onChange={refreshAll}
          />
        ))}
      </div>
    </div>
  );
}

function OfferExpenses({
  offer,
  month,
  expenses,
  onChange,
}: {
  offer: (typeof OFFERS)[number];
  month: string;
  expenses: Expense[] | undefined;
  onChange: () => Promise<unknown>;
}) {
  const [tool, setTool] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const costNumber = Number.parseFloat(cost.replace(/[^0-9.]/g, ""));
  const canAdd = tool.trim() !== "" && Number.isFinite(costNumber) && !busy;

  async function send(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/agency/expenses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer: offer.key, ...body }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await onChange();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!canAdd) return;
    if (await send("POST", { month, tool: tool.trim(), cost })) {
      setTool("");
      setCost("");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        <span className="h-2 w-2 rounded-full" style={{ background: offer.dot }} />
        {offer.label}
      </div>
      <div className="mt-2 text-4xl font-bold text-red-400">
        {expenses ? formatStatValue(sum(expenses), "currency") : "—"}
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">{offer.note}</div>

      {expenses && expenses.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--panel-border)] text-sm">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate text-[var(--text-strong)]">{e.tool}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-red-400">{formatStatValue(e.cost, "currency")}</span>
                <button
                  type="button"
                  onClick={() => send("DELETE", { id: e.id })}
                  disabled={busy}
                  className="text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40"
                  aria-label={`Remove ${e.tool}`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          {expenses ? "No expenses this month." : "Loading..."}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          placeholder="Tool"
          className="min-w-0 flex-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
        />
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost"
          inputMode="decimal"
          className="w-24 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
        />
        <button
          type="submit"
          disabled={!canAdd}
          className="rounded-md bg-[var(--btn-active-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-active-fg)] disabled:opacity-40"
        >
          {busy ? "..." : "Add"}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-[var(--cell-red-text)]">Couldn&apos;t save, try again.</p>
      )}
    </div>
  );
}
