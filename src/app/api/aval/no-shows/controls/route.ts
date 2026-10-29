import type { NextRequest } from "next/server";
import { getReactivationRows, setReactivationSetting } from "@/lib/airtable/reactivation";

export const dynamic = "force-dynamic";

/** Behind the admin password (src/proxy.ts): ON/OFF for the no-show engine (noshow_on in Show Rate Settings). */
export async function GET() {
  const rows = await getReactivationRows("avalMasterclass", "settings");
  return Response.json({ engineOn: rows.some((r) => r.fields.Key === "noshow_on" && r.fields.Value === "1") });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { action?: string; on?: boolean };
  if (body.action !== "toggle") return Response.json({ error: "Unknown action" }, { status: 400 });
  await setReactivationSetting("avalMasterclass", "noshow_on", body.on ? "1" : "0");
  return Response.json({ ok: true });
}
