import type { NextRequest } from "next/server";
import {
  getFunnel, saveLayout, addSection, renameSection, deleteSection, addSite, updateSite, deleteSite,
} from "@/lib/berlin/websites";

export const dynamic = "force-dynamic";

/** Funnel tab: every Bronson website by section. POST saves drag-and-drop order and edits. */
export async function GET() {
  return Response.json({ sections: await getFunnel() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (body[k] === undefined ? undefined : String(body[k]).trim());
  try {
    switch (body.action) {
      case "layout":
        await saveLayout(body.layout as Parameters<typeof saveLayout>[0]);
        break;
      case "addSection":
        if (!str("name")) return Response.json({ error: "Name required" }, { status: 400 });
        await addSection(str("name")!, str("description") ?? "");
        break;
      case "renameSection":
        if (!str("id") || !str("name")) return Response.json({ error: "Missing fields" }, { status: 400 });
        await renameSection(str("id")!, str("name")!, str("description"));
        break;
      case "deleteSection":
        await deleteSection(String(body.id));
        break;
      case "addSite":
        if (!str("name") || !str("url") || !str("section")) return Response.json({ error: "Name, URL and section required" }, { status: 400 });
        await addSite({ name: str("name")!, url: str("url")!, description: str("description"), section: str("section")! });
        break;
      case "updateSite":
        await updateSite(String(body.id), { name: str("name"), url: str("url"), description: str("description") });
        break;
      case "deleteSite":
        await deleteSite(String(body.id));
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Save failed" }, { status: 500 });
  }
  return Response.json({ sections: await getFunnel() });
}
