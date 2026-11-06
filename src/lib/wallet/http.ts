import { eventById, passTypeId } from "./config";
import { PKPASS_TYPE, buildPkpass, passUpdatedAt } from "./pass";
import { getPass, type PassFields } from "./store";

export const isIphone = (ua: string | null) => /iPhone|iPod/.test(ua ?? "") || (/iPad/.test(ua ?? "") && /Mobile/.test(ua ?? ""));

/** The signed pass. No Content-Disposition, or iOS downloads it instead of opening Wallet. */
export function pkpassResponse(pass: PassFields, request: Request): Response {
  const ev = eventById(pass.Event);
  if (!ev) return new Response("Unknown event", { status: 404 });
  const updated = passUpdatedAt(ev);
  const since = request.headers.get("if-modified-since");
  if (since && !Number.isNaN(Date.parse(since)) && Date.parse(since) >= updated.getTime()) {
    return new Response(null, { status: 304, headers: { "Last-Modified": updated.toUTCString() } });
  }
  const { body, hash } = buildPkpass(ev, pass.Serial, pass["Auth Token"]);
  if (request.headers.get("if-none-match") === `"${hash}"`) {
    return new Response(null, { status: 304, headers: { "Last-Modified": updated.toUTCString(), ETag: `"${hash}"` } });
  }
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": PKPASS_TYPE,
      "Last-Modified": updated.toUTCString(),
      ETag: `"${hash}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Apple's web service auth: "Authorization: ApplePass <authenticationToken>". */
export async function authorisedPass(request: Request, typeId: string, serial: string) {
  if (typeId !== passTypeId()) return { error: new Response(null, { status: 404 }) };
  const pass = await getPass(serial);
  if (!pass) return { error: new Response(null, { status: 404 }) };
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `ApplePass ${pass["Auth Token"]}`) return { error: new Response(null, { status: 401 }) };
  return { pass };
}
