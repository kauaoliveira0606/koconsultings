import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getBronsonPaidPnl } from "@/lib/bronson-paid-pnl";

// Expenses are read live (never cached), so this can't be statically revalidated.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return Response.json(await getBronsonPaidPnl(parseRangeFromRequest(request)));
}
