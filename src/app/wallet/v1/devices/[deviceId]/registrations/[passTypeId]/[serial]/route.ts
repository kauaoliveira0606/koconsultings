import { authorisedPass } from "@/lib/wallet/http";
import { deactivate, upsertRegistration } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]">;

/** A device installed the pass: 201 new, 200 already registered. */
export async function POST(request: Request, ctx: Ctx) {
  const { deviceId, passTypeId, serial } = await ctx.params;
  const { pass, error } = await authorisedPass(request, passTypeId, serial);
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { pushToken?: string };
  if (!body.pushToken) return new Response(null, { status: 400 });
  const res = await upsertRegistration(
    { "Device ID": deviceId, "Push Token": body.pushToken, Serial: serial, Event: pass.Event },
    true
  );
  return new Response(null, { status: res.created || !res.wasActive ? 201 : 200 });
}

/** The device removed the pass. */
export async function DELETE(request: Request, ctx: Ctx) {
  const { deviceId, passTypeId, serial } = await ctx.params;
  const { error } = await authorisedPass(request, passTypeId, serial);
  if (error) return error;
  await deactivate(deviceId, serial);
  return new Response(null, { status: 200 });
}
