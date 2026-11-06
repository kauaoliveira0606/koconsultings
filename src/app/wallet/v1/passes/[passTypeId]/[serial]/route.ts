import { authorisedPass, pkpassResponse } from "@/lib/wallet/http";

export const dynamic = "force-dynamic";

/** The latest version of a pass. Honours If-Modified-Since (304 when unchanged). */
export async function GET(request: Request, ctx: RouteContext<"/wallet/v1/passes/[passTypeId]/[serial]">) {
  const { passTypeId, serial } = await ctx.params;
  const { pass, error } = await authorisedPass(request, passTypeId, serial);
  if (error) return error;
  return pkpassResponse(pass, request);
}
