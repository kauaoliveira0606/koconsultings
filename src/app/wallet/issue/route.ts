import { eventById } from "@/lib/wallet/config";
import { createPass } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/** POST /wallet/issue {event, source?} with header x-api-key: WALLET_ADMIN_KEY. Admin minting. */
export async function POST(request: Request) {
  const adminKey = process.env.WALLET_ADMIN_KEY;
  if (!adminKey || request.headers.get("x-api-key") !== adminKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { event?: string; source?: string };
  const ev = eventById(body.event ?? "");
  if (!ev) return Response.json({ error: "Unknown event" }, { status: 404 });
  const pass = await createPass(ev.id, body.source ?? "admin");
  const origin = new URL(request.url).origin;
  return Response.json({ serial: pass.Serial, url: `${origin}/wallet/p/${pass.Serial}` });
}
