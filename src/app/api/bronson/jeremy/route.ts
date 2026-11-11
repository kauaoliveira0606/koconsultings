import type { NextRequest } from "next/server";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";
import { snapshotText } from "@/lib/berlin-snapshot";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Chat with Jeremy AI from anywhere in the dashboard. Jeremy AI has Berlin connected, so it pulls the numbers itself. */
export async function POST(request: NextRequest) {
  if (!jeremyConfigured()) return Response.json({ error: "Jeremy AI isn't connected yet (needs its MCP token)." }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as { message?: string; conversationId?: string | null; page?: string };
  const message = String(b.message ?? "").trim();
  if (!message) return Response.json({ error: "Type a message first." }, { status: 400 });
  // Jeremy AI's persona chat can't call Berlin's tools, so the first message of a
  // conversation carries a snapshot of the live numbers (ads, pace, scores, alerts, overview).
  let framed = message;
  if (!b.conversationId) {
    const data = await snapshotText(new URL(request.url).origin).catch(() => "");
    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    framed = `[Sent from the Berlin dashboard for Bronson / The Inner Table (page: ${b.page ?? "unknown"}). Live numbers as of ${now} ET are below as JSON; use them for anything about performance. Rates are percentages.]\n\n${message}${data ? `\n\nLIVE NUMBERS:\n${data}` : ""}`;
  }
  try {
    const r = await askJeremy(framed, b.conversationId ?? null);
    return Response.json({ answer: r.text, conversationId: r.conversationId });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Jeremy AI request failed" }, { status: 502 });
  }
}

export function GET() {
  return Response.json({ connected: jeremyConfigured() });
}
