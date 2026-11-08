import { eventById } from "@/lib/wallet/config";
import { isIphone, pkpassResponse } from "@/lib/wallet/http";
import { phase } from "@/lib/wallet/schedule";
import { getPass } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** GET /wallet/p/<token> landing page, GET /wallet/p/<token>.pkpass the signed pass. */
export async function GET(request: Request, ctx: RouteContext<"/wallet/p/[token]">) {
  const { token } = await ctx.params;
  const wantsFile = token.endsWith(".pkpass");
  const serial = token.replace(/\.pkpass$/, "");
  const pass = await getPass(serial);
  if (!pass) return new Response("Pass not found", { status: 404 });
  if (wantsFile) return pkpassResponse(pass, request);

  const ev = eventById(pass.Event);
  if (!ev) return new Response("Unknown event", { status: 404 });
  const { start } = phase(ev);
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: ev.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(start);
  // Bronson's event has no page colours: these defaults are its original CSS.
  const c = ev.page ?? { accent: "#16a34a", glow: "rgba(34,197,94,.18)", bgTop: "#f2faf5", bgBottom: "#fcfdfc", tagBg: "#dcfce7", tagInk: "#15803d" };
  const page = new URL(request.url);
  const iphone = isIphone(request.headers.get("user-agent"));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ev.name)} | Lock Screen Reminder</title><meta name="robots" content="noindex">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0f172a;--green:${c.accent}}
*{box-sizing:border-box;margin:0}
body{font-family:Inter,system-ui,sans-serif;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:radial-gradient(700px 400px at 10% -10%,${c.glow},transparent 60%),linear-gradient(180deg,${c.bgTop},${c.bgBottom})}
.card{max-width:420px;width:100%;background:#fff;border-radius:20px;padding:32px 24px;text-align:center;box-shadow:0 22px 48px -24px rgba(15,23,42,.3)}
.tag{display:inline-block;padding:5px 12px;border-radius:999px;background:${c.tagBg};color:${c.tagInk};font:800 .72rem 'Plus Jakarta Sans',sans-serif;letter-spacing:1.3px;text-transform:uppercase}
h1{font:800 1.6rem/1.2 'Plus Jakarta Sans',sans-serif;color:var(--ink);margin-top:14px;letter-spacing:-.4px}
.when{margin-top:8px;font-weight:600;color:var(--ink)}
p{margin-top:14px;line-height:1.55}
.add{display:inline-flex;align-items:center;gap:10px;margin-top:22px;padding:15px 26px;border-radius:999px;background:#000;color:#fff;text-decoration:none;font:700 1.02rem 'Plus Jakarta Sans',sans-serif}
#qr{display:inline-block;margin-top:20px;padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
.small{font-size:.85rem;color:#475569}
.url{display:block;margin-top:4px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;word-break:break-all}
</style></head><body><div class="card">
<span class="tag">${esc(ev.brand)}</span>
<h1>Get a reminder on your lock screen before we start</h1>
<div class="when">${esc(ev.name)} · ${esc(when)}</div>
${
  iphone
    ? `<a class="add" href="/wallet/p/${serial}.pkpass">Add To Apple Wallet</a>
<p class="small">Your pass shows up on your lock screen before the masterclass, with the join link one tap away.</p>`
    : `<p>Apple Wallet passes only add on an iPhone. Scan this with your iPhone camera:</p>
<div id="qr"></div>
<p class="small">Or open this page on your iPhone:<span class="url">${esc(page.origin + page.pathname)}</span></p>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>new QRCode(document.getElementById('qr'),{text:${JSON.stringify(page.origin + page.pathname)},width:180,height:180,colorDark:'#0f172a'});</script>`
}
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
