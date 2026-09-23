import { AirtableError } from "@/lib/airtable/client";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

/**
 * "Expenses" table in the Bronson and Andy bases: monthly tool/software
 * bills typed straight into the /agency page (Tool + Cost + Month, where
 * Month is the 1st of that month). Aval has none — it's a straight
 * revenue share with only ad spend coming off.
 */
export type ExpensesTable = { baseId: string; tableId: string };

export const EXPENSE_TABLES = {
  bronson: { baseId: "appiMw8gpaLv2WITA", tableId: "tblSPyipFbLZ3Uqck" },
  ecomSimulation: { baseId: "appgcEYqudlGfqBjE", tableId: "tbl7nv9gTLKAy5iWY" },
} satisfies Record<string, ExpensesTable>;

export type ExpenseOffer = keyof typeof EXPENSE_TABLES;

export function isExpenseOffer(value: unknown): value is ExpenseOffer {
  return typeof value === "string" && value in EXPENSE_TABLES;
}

export type Expense = { id: string; tool: string; cost: number; month: string };

type ExpenseRecord = { id: string; fields: { Tool?: string; Cost?: number; Month?: string } };

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
      expenses.push({ id: r.id, tool: r.fields.Tool, cost: r.fields.Cost ?? 0, month });
    }
    offset = body.offset;
  } while (offset);
  return expenses;
}

/** Total expenses per month ("YYYY-MM"). */
export function expensesByMonth(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.month, (map.get(e.month) ?? 0) + e.cost);
  return map;
}

export async function addExpense(table: ExpensesTable, month: string, tool: string, cost: number) {
  await airtable(`${AIRTABLE_API_BASE}/${table.baseId}/${table.tableId}`, {
    method: "POST",
    body: JSON.stringify({ fields: { Tool: tool, Cost: cost, Month: `${month}-01` } }),
  });
}

export async function deleteExpense(table: ExpensesTable, id: string) {
  await airtable(`${AIRTABLE_API_BASE}/${table.baseId}/${table.tableId}/${id}`, {
    method: "DELETE",
  });
}
