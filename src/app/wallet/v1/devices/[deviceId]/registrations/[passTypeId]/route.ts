import { eventById, passTypeId as ourPassType } from "@/lib/wallet/config";
import { passUpdatedAt } from "@/lib/wallet/pass";
import { activeRegistrations } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/**
 * Which of this device's passes changed since `passesUpdatedSince`. The tag is
 * epoch seconds of the newest change we report.
 */
export async function GET(request: Request, ctx: RouteContext<"/wallet/v1/devices/[deviceId]/registrations/[passTypeId]">) {
  const { deviceId, passTypeId } = await ctx.params;
  if (passTypeId !== ourPassType()) return new Response(null, { status: 404 });
  const since = Number(new URL(request.url).searchParams.get("passesUpdatedSince") ?? "0") || 0;
  const regs = await activeRegistrations({ deviceId });
  if (!regs.length) return new Response(null, { status: 404 });
  let newest = since;
  const serials: string[] = [];
  for (const r of regs) {
    const ev = eventById(r.Event);
    if (!ev) continue;
    const updated = Math.floor(passUpdatedAt(ev).getTime() / 1000);
    if (updated > since) {
      serials.push(r.Serial);
      newest = Math.max(newest, updated);
    }
  }
  if (!serials.length) return new Response(null, { status: 204 });
  return Response.json({ serialNumbers: [...new Set(serials)], lastUpdated: String(newest) });
}
