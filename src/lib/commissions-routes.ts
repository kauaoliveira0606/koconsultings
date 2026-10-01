import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { addClawback, deleteClawback } from "@/lib/airtable/clawbacks";
import { clawbacksTable, getCommissions, type CommissionsOffer } from "@/lib/airtable/commissions";

/** Route handlers for an offer's Commissions tab, so each offer's route.ts stays a one-liner. */
export function commissionsGet(offer: CommissionsOffer) {
  return async (request: NextRequest) =>
    Response.json(await getCommissions(offer, parseRangeFromRequest(request)));
}

// Adds a manual clawback, written on the Commissions tab itself.
export function clawbackPost(offer: CommissionsOffer) {
  return async (request: Request) => {
    const body = (await request.json().catch(() => null)) as {
      rep?: unknown;
      date?: unknown;
      amount?: unknown;
      note?: unknown;
    } | null;
    const rep = typeof body?.rep === "string" ? body.rep.trim() : "";
    const date = typeof body?.date === "string" ? body.date : "";
    const amount = typeof body?.amount === "number" ? body.amount : NaN;
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!rep || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: "Expected { rep: string, date: YYYY-MM-DD, amount: number > 0, note?: string }" },
        { status: 400 }
      );
    }
    await addClawback(clawbacksTable(offer), { rep, date, amount, note });
    return Response.json({ ok: true });
  };
}

export function clawbackDelete(offer: CommissionsOffer) {
  return async (request: Request) => {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) {
      return Response.json({ error: "Expected ?id=<record id>" }, { status: 400 });
    }
    await deleteClawback(clawbacksTable(offer), id);
    return Response.json({ ok: true });
  };
}
