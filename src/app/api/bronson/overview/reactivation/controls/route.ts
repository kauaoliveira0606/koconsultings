import type { NextRequest } from "next/server";
import {
  getReactivationDrafts,
  getReactivationSettings,
  setDraftStatus,
  setReactivationSetting,
} from "@/lib/airtable/reactivation";

export const dynamic = "force-dynamic";

const OFFER = "bronson";

/** Behind the admin password (src/proxy.ts): ON/OFF, daily cap, drafts to approve. */
export async function GET() {
  const [settings, drafts] = await Promise.all([getReactivationSettings(OFFER), getReactivationDrafts(OFFER)]);
  return Response.json({
    ...settings,
    drafts: drafts
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d) => ({ id: d.id, leadName: d.leadName, body: d.body, touch: d.touch, createdAt: d.createdAt })),
  });
}

type Body =
  | { action: "toggle"; on: boolean }
  | { action: "cap"; cap: number }
  | { action: "approve" | "reject"; id: string };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  switch (body.action) {
    case "toggle":
      await setReactivationSetting(OFFER, "engine_on", body.on ? "1" : "0");
      // Turning it back on clears the safety switch's reason.
      if (body.on) await setReactivationSetting(OFFER, "off_reason", "");
      break;
    case "cap": {
      const cap = Math.floor(Number(body.cap));
      if (!Number.isFinite(cap) || cap < 0 || cap > 1000) {
        return Response.json({ error: "Cap must be between 0 and 1000" }, { status: 400 });
      }
      await setReactivationSetting(OFFER, "daily_cap", String(cap));
      break;
    }
    case "approve":
    case "reject":
      if (!body.id?.startsWith("rec")) return Response.json({ error: "Bad draft id" }, { status: 400 });
      await setDraftStatus(OFFER, body.id, body.action === "approve" ? "approved" : "rejected");
      break;
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
