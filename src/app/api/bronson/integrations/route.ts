import type { NextRequest } from "next/server";
import { INTEGRATIONS } from "@/lib/berlin/integrations";
import { runChecks, type CheckResult } from "@/lib/integration-checks";

export const dynamic = "force-dynamic";

/**
 * Live connection checks (no manual "Connect" toggle: it only flipped a label).
 * Results are kept 5 minutes per server instance; ?fresh=1 re-checks now.
 */
let cache: { at: number; results: CheckResult[] } | null = null;

export async function GET(request: NextRequest) {
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  if (!fresh && cache && Date.now() - cache.at < 5 * 60_000) return Response.json({ results: cache.results });
  const results = await runChecks(INTEGRATIONS.map((i) => i.name));
  cache = { at: Date.now(), results };
  return Response.json({ results });
}
