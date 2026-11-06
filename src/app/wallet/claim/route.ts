import { eventByKey } from "@/lib/wallet/config";
import { createPass } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/** POST /wallet/claim {key, source?}: public, mints a pass with an event's public key. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { key?: string; source?: string };
  const ev = eventByKey(body.key ?? "");
  if (!ev) return Response.json({ error: "Unknown event key" }, { status: 404 });
  const pass = await createPass(ev.id, body.source ?? "claim");
  const origin = new URL(request.url).origin;
  return Response.json(
    { serial: pass.Serial, url: `${origin}/wallet/p/${pass.Serial}`, pkpass: `${origin}/wallet/p/${pass.Serial}.pkpass` },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
