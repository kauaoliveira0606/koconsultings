import type { NextRequest } from "next/server";
import { FLOW_TYPES, getFlows, startFlow } from "@/lib/flows";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ flows: await getFlows(), types: Object.fromEntries(Object.entries(FLOW_TYPES).map(([k, v]) => [k, { label: v.label, steps: v.steps.map((s) => s.name) }])) });
}

/** Start a flow: idea -> chain of AI tasks in the Office. */
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { name?: string; idea?: string; type?: string };
  const name = String(b.name ?? "").trim().replace(/·/g, "-");
  const idea = String(b.idea ?? "").trim();
  if (!name || !idea) return Response.json({ error: "Give the flow a name and describe the idea." }, { status: 400 });
  await startFlow(name, idea, (b.type && b.type in FLOW_TYPES ? b.type : "launch") as keyof typeof FLOW_TYPES);
  return Response.json({ flows: await getFlows() });
}
