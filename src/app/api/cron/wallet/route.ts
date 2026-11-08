import { pushToDevices } from "@/lib/wallet/apns";
import { WALLET_EVENTS } from "@/lib/wallet/config";
import { phase, w3c } from "@/lib/wallet/schedule";
import { activeRegistrations, deactivateByToken, nudgeSent, recordNudge } from "@/lib/wallet/store";

/**
 * Every 5 minutes (vercel.json). Per event and session, pushes each nudge once:
 *  - "roll":     the pass moved to next week's session (header changeMessage "Next session: %@")
 *  - "tomorrow": 24 hours before  -> status "Starts tomorrow"
 *  - "today":    local midnight of the session day -> status "Starts today" (silent, no alert)
 *  - "lead":     the event's lead time before -> status "Starts in N hours"
 *  - "now":      15 minutes before -> status "Starting now"
 * The push itself is empty; the alert comes from the status field changing.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const fromVercel = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : request.headers.get("user-agent")?.includes("vercel-cron");
  if (!fromVercel) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.WALLET_CERT_PEM) return Response.json({ skipped: "wallet certificate not configured" });

  const results: unknown[] = [];
  for (const ev of WALLET_EVENTS) {
    const ph = phase(ev);
    const kind = ph.phase === "confirmed" ? "roll" : ph.phase === "ended" ? null : ph.phase;
    if (!kind) continue;
    const occurrence = w3c(ph.start);
    const key = `${ev.id}|${occurrence}|${kind}`;
    if (await nudgeSent(key)) continue;
    const regs = await activeRegistrations({ eventId: ev.id });
    const res = await pushToDevices(regs.map((r) => r["Push Token"]));
    for (const token of res.gone) await deactivateByToken(token);
    await recordNudge({ Key: key, Event: ev.id, Occurrence: occurrence, Kind: kind, Devices: res.sent });
    results.push({ event: ev.id, kind, occurrence, ...res, gone: res.gone.length });
  }
  return Response.json({ ok: true, results });
}
