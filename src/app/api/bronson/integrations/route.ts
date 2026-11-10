import type { NextRequest } from "next/server";
import { getStatuses, setStatus } from "@/lib/integration-status";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ statuses: await getStatuses() });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.name ?? "");
  if (!name) return Response.json({ error: "Missing name" }, { status: 400 });
  try {
    await setStatus(name, Boolean(body.connected), body.note !== undefined ? String(body.note) : undefined);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Write failed" }, { status: 500 });
  }
  return Response.json({ statuses: await getStatuses() });
}
