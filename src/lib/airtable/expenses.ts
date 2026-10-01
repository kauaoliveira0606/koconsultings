import { AirtableError } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/**
 * "Expenses" table in the Bronson and Andy bases: monthly tool/software
 * bills typed straight into the /agency page (Tool + Cost + Month, where
 * Month is the 1st of that month). Aval has none — it's a straight
 * revenue share with only ad spend coming off.
 *
 * Bronson's bills are recurring: a month with no rows of its own carries
 * over the latest earlier month's list, until someone edits that month (the
 * edit first copies the list into it). Bronson rows can also be ticked
 * "Paid By Me" — a bill the agency owner paid on his own card, which Bronson
 * reimburses in full on top of the profit split.
 */
export type ExpensesTable = {
  baseId: string;
  tableId: string;
  /** Months with no rows of their own inherit the latest earlier month's list. */
  recurring?: boolean;
  /** The table has a "Paid By Me" checkbox. */
  reimbursable?: boolean;
};

export const EXPENSE_TABLES: Record<"bronson" | "ecomSimulation", ExpensesTable> = {
  bronson: {
    baseId: "appiMw8gpaLv2WITA",
    tableId: "tblSPyipFbLZ3Uqck",
    recurring: true,
    reimbursable: true,
  },
  ecomSimulation: { baseId: "appgcEYqudlGfqBjE", tableId: "tbl7nv9gTLKAy5iWY" },
};

export type ExpenseOffer = keyof typeof EXPENSE_TABLES;

export function isExpenseOffer(value: unknown): value is ExpenseOffer {
  return typeof value === "string" && value in EXPENSE_TABLES;
}

export type Expense = {
  id: string;
  tool: string;
  cost: number;
  month: string;
  /** The agency owner paid this bill himself; the client reimburses it in full. */
  paidByMe: boolean;
  /** Set when this row is carried over from an earlier month ("YYYY-MM") rather than saved for `month`. */
  carriedFrom?: string;
};

type ExpenseRecord = {
  id: string;
  fields: { Tool?: string; Cost?: number; Month?: string; "Paid By Me"?: boolean };
};

function authHeaders() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

async function airtable<T>(url: string, init: RequestInit = {}): Promise<T> {
  // Never cached: an expense must show up in the numbers right after it's saved.
  const res = await fetch(url, { ...init, headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new AirtableError(`Airtable request failed for ${url} (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

/** Keeps only the number out of whatever was typed: "$49.99/mo" → 49.99, "1,200" → 1200. */
export function parseCost(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : null;
}

export async function listExpenses({ baseId, tableId }: ExpensesTable): Promise<Expense[]> {
  const expenses: Expense[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const body = await airtable<{ records: ExpenseRecord[]; offset?: string }>(
      `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${qs}`
    );
    for (const r of body.records) {
      const month = r.fields.Month?.slice(0, 7);
      if (!month || !r.fields.Tool) continue;
      expenses.push({
        id: r.id,
        tool: r.fields.Tool,
        cost: r.fields.Cost ?? 0,
        month,
        paidByMe: r.fields["Paid By Me"] === true,
      });
    }
    offset = body.offset;
  } while (offset);
  return expenses;
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * The expenses that actually count: saved rows, plus (recurring tables only)
 * the carried-over list for every month up to the current one that has no
 * rows of its own. Carried rows keep the source row's id and say where they
 * came from in `carriedFrom`.
 */
export function effectiveExpenses(table: ExpensesTable, saved: Expense[]): Expense[] {
  if (!table.recurring || saved.length === 0) return saved;
  const byMonth = new Map<string, Expense[]>();
  for (const e of saved) byMonth.set(e.month, [...(byMonth.get(e.month) ?? []), e]);

  const result = [...saved];
  const thisMonth = easternDateString().slice(0, 7);
  const first = [...byMonth.keys()].sort()[0];
  let source = first;
  for (let month = first; month <= thisMonth; month = nextMonth(month)) {
    if (byMonth.has(month)) {
      source = month;
      continue;
    }
    for (const e of byMonth.get(source) ?? []) result.push({ ...e, month, carriedFrom: source });
  }
  return result;
}

/** What the agency owner paid himself, per month ("YYYY-MM") — owed back in full. */
export function reimbursementsByMonth(expenses: Expense[]): Map<string, number> {
  return expensesByMonth(expenses.filter((e) => e.paidByMe));
}

/** Total expenses per month ("YYYY-MM"). */
export function expensesByMonth(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.month, (map.get(e.month) ?? 0) + e.cost);
  return map;
}

const tableUrl = (table: ExpensesTable) => `${AIRTABLE_API_BASE}/${table.baseId}/${table.tableId}`;

function fields(table: ExpensesTable, e: Pick<Expense, "tool" | "cost" | "month" | "paidByMe">) {
  return {
    Tool: e.tool,
    Cost: e.cost,
    Month: `${e.month}-01`,
    ...(table.reimbursable ? { "Paid By Me": e.paidByMe } : {}),
  };
}

/**
 * Makes `month` own its list before an edit: when it is only showing rows
 * carried over from an earlier month, those are saved as real rows for
 * `month`. Returns how to translate a carried row's id into its new copy.
 */
async function ownMonth(table: ExpensesTable, month: string): Promise<(id: string) => string> {
  const carried = effectiveExpenses(table, await listExpenses(table)).filter(
    (e) => e.month === month && e.carriedFrom
  );
  const copies = new Map<string, string>();
  for (let i = 0; i < carried.length; i += 10) {
    const batch = carried.slice(i, i + 10);
    const body = await airtable<{ records: { id: string }[] }>(tableUrl(table), {
      method: "POST",
      body: JSON.stringify({ records: batch.map((e) => ({ fields: fields(table, e) })) }),
    });
    batch.forEach((e, j) => copies.set(e.id, body.records[j].id));
  }
  return (id) => copies.get(id) ?? id;
}

export async function addExpense(table: ExpensesTable, month: string, tool: string, cost: number) {
  await ownMonth(table, month);
  await airtable(tableUrl(table), {
    method: "POST",
    body: JSON.stringify({ fields: fields(table, { tool, cost, month, paidByMe: false }) }),
  });
}

/** `month` is the month being edited — a carried-over row is removed from it, not from its source month. */
export async function deleteExpense(table: ExpensesTable, month: string, id: string) {
  const own = await ownMonth(table, month);
  await airtable(`${tableUrl(table)}/${own(id)}`, { method: "DELETE" });
}

export async function setExpensePaidByMe(
  table: ExpensesTable,
  month: string,
  id: string,
  paidByMe: boolean
) {
  if (!table.reimbursable) return;
  const own = await ownMonth(table, month);
  await airtable(`${tableUrl(table)}/${own(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { "Paid By Me": paidByMe } }),
  });
}
