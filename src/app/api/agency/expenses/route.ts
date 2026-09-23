import {
  EXPENSE_TABLES,
  addExpense,
  deleteExpense,
  isExpenseOffer,
  listExpenses,
  parseCost,
} from "@/lib/airtable/expenses";

// Always needs live Airtable data.
export const dynamic = "force-dynamic";

/** Every expense for one month ("YYYY-MM"), per offer. */
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }
  const [bronson, ecomSimulation] = await Promise.all([
    listExpenses(EXPENSE_TABLES.bronson),
    listExpenses(EXPENSE_TABLES.ecomSimulation),
  ]);
  return Response.json({
    bronson: bronson.filter((e) => e.month === month),
    ecomSimulation: ecomSimulation.filter((e) => e.month === month),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    offer?: unknown;
    month?: unknown;
    tool?: unknown;
    cost?: unknown;
  } | null;
  const month = typeof body?.month === "string" ? body.month : "";
  const tool = typeof body?.tool === "string" ? body.tool.trim() : "";
  const cost = typeof body?.cost === "string" ? parseCost(body.cost) : null;
  if (!isExpenseOffer(body?.offer) || !/^\d{4}-\d{2}$/.test(month) || !tool || cost === null) {
    return Response.json(
      { error: "Expected { offer, month: YYYY-MM, tool, cost } with a number in cost" },
      { status: 400 }
    );
  }
  await addExpense(EXPENSE_TABLES[body.offer], month, tool, cost);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { offer?: unknown; id?: unknown } | null;
  if (!isExpenseOffer(body?.offer) || typeof body?.id !== "string" || !/^rec\w+$/.test(body.id)) {
    return Response.json({ error: "Expected { offer, id }" }, { status: 400 });
  }
  await deleteExpense(EXPENSE_TABLES[body.offer], body.id);
  return Response.json({ ok: true });
}
