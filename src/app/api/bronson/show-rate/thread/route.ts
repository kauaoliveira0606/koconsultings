import type { NextRequest } from "next/server";
import { getReactivationMessages } from "@/lib/airtable/reactivation";

export const revalidate = 60;

/** Full text thread for one lead, oldest first. Drafts are left out. */
export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get("contact");
  if (!contactId) return Response.json({ error: "contact is required" }, { status: 400 });
  const messages = (await getReactivationMessages("bronsonMasterclass"))
    .filter((m) => m.contactId === contactId && !["draft", "approved", "rejected"].includes(m.status))
    .sort((a, b) => (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt))
    .map((m) => ({ id: m.id, direction: m.direction, body: m.body, at: m.sentAt ?? m.createdAt, touch: m.touch, status: m.status }));
  return Response.json({ messages });
}
