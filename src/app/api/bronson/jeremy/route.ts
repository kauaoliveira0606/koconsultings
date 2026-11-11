import type { NextRequest } from "next/server";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Chat with Jeremy AI from anywhere in the dashboard. Jeremy AI has Berlin connected, so it pulls the numbers itself. */
export async function POST(request: NextRequest) {
  if (!jeremyConfigured()) return Response.json({ error: "Jeremy AI isn't connected yet (needs its MCP token)." }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as { message?: string; conversationId?: string | null; page?: string };
  const message = String(b.message ?? "").trim();
  if (!message) return Response.json({ error: "Type a message first." }, { status: 400 });
  // First message of a conversation carries where the operator is, so Jeremy AI knows which numbers to pull.
  const framed = b.conversationId
    ? message
    : `[From the Berlin dashboard for Bronson / The Inner Table, page: ${b.page ?? "unknown"}. Use your Berlin tools for any numbers.]\n\n${message}`;
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
