import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { getPayouts } from "@/lib/payouts";

// Expenses are read live (never cached), so this can't be statically revalidated.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return Response.json(await getPayouts("bronson", parseRangeFromRequest(request)));
}
