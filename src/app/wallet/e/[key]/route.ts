import { eventByKey } from "@/lib/wallet/config";
import { isIphone } from "@/lib/wallet/http";
import { createPass } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/**
 * Public claim link for a landing page button ("Get My Pass"). Mints one pass
 * per tap. iPhones go straight to the .pkpass (Safari opens the Add to Wallet
 * sheet); everything else gets the landing page with a QR to scan.
 */
export async function GET(request: Request, ctx: RouteContext<"/wallet/e/[key]">) {
  const { key } = await ctx.params;
  const ev = eventByKey(key);
  if (!ev) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const source = url.searchParams.get("src") ?? request.headers.get("referer") ?? "";
  const pass = await createPass(ev.id, source);
  const ua = request.headers.get("user-agent");
  const dest = isIphone(ua) ? `/wallet/p/${pass.Serial}.pkpass` : `/wallet/p/${pass.Serial}`;
  return Response.redirect(new URL(dest, url.origin), 302);
}
