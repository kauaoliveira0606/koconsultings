/**
 * Aval's GoHighLevel calendars, read for the Live Calls tab alongside
 * Calendly: every appointment from now through the next few days, shown in
 * the same shape as a Calendly call.
 */

import type { LiveCall } from "@/lib/calendly";

const GHL_API = "https://services.leadconnectorhq.com";

type GhlCalendar = { id: string; name: string; isActive?: boolean };

type GhlEvent = {
  id: string;
  calendarId: string;
  contactId?: string;
  assignedUserId?: string;
  startTime: string;
  endTime: string;
  title?: string;
  appointmentStatus?: string;
  deleted?: boolean;
  address?: string;
};

async function ghlGet<T>(pat: string, path: string, version: string): Promise<T> {
  const res = await fetch(`${GHL_API}${path}`, {
    headers: { Authorization: `Bearer ${pat}`, Version: version },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GHL request failed (${res.status}) for ${path.split("?")[0]}`);
  return res.json() as Promise<T>;
}

export async function getAvalGhlLiveCalls(days = 7): Promise<LiveCall[]> {
  const pat = process.env.GHL_AVAL_PIT;
  const locationId = process.env.GHL_AVAL_LOCATION_ID;
  if (!pat || !locationId) throw new Error("Missing GHL_AVAL_PIT or GHL_AVAL_LOCATION_ID");

  const now = Date.now();
  // Look back far enough to catch calls already in progress.
  const startTime = now - 3 * 60 * 60 * 1000;
  const endTime = now + days * 24 * 60 * 60 * 1000;

  const { calendars } = await ghlGet<{ calendars: GhlCalendar[] }>(
    pat,
    `/calendars/?locationId=${locationId}`,
    "2021-04-15"
  );
  const events = (
    await Promise.all(
      calendars.map(async (cal) => {
        const { events } = await ghlGet<{ events: GhlEvent[] }>(
          pat,
          `/calendars/events?${new URLSearchParams({
            locationId,
            calendarId: cal.id,
            startTime: String(startTime),
            endTime: String(endTime),
          })}`,
          "2021-04-15"
        );
        return events.map((e) => ({ ...e, calendarName: cal.name }));
      })
    )
  )
    .flat()
    .filter((e) => !e.deleted && new Date(e.endTime).getTime() > now);

  // Host and lead names, one lookup each.
  const userIds = [...new Set(events.map((e) => e.assignedUserId).filter((id): id is string => !!id))];
  const contactIds = [...new Set(events.map((e) => e.contactId).filter((id): id is string => !!id))];
  const [users, contacts] = await Promise.all([
    Promise.all(
      userIds.map((id) =>
        ghlGet<{ name?: string }>(pat, `/users/${id}`, "2021-07-28")
          .then((u) => [id, u.name ?? null] as const)
          .catch(() => [id, null] as const)
      )
    ),
    Promise.all(
      contactIds.map((id) =>
        ghlGet<{ contact: { firstName?: string; lastName?: string; email?: string } }>(
          pat,
          `/contacts/${id}`,
          "2021-07-28"
        )
          .then(({ contact: c }) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || null;
            return [id, { name, email: c.email ?? null }] as const;
          })
          .catch(() => [id, { name: null, email: null }] as const)
      )
    ),
  ]);
  const hostOf = new Map(users);
  const contactOf = new Map(contacts);

  return events.map((e): LiveCall => {
    const status = (e.appointmentStatus ?? "").toLowerCase();
    const contact = e.contactId ? contactOf.get(e.contactId) : undefined;
    return {
      id: `ghl-${e.id}`,
      eventName: e.calendarName,
      start: new Date(e.startTime).toISOString(),
      end: new Date(e.endTime).toISOString(),
      host: (e.assignedUserId && hostOf.get(e.assignedUserId)) || null,
      status: status === "cancelled" || status === "invalid" ? "canceled" : now >= new Date(e.startTime).getTime() ? "live" : "scheduled",
      inviteeName: contact?.name ?? e.title ?? null,
      inviteeEmail: contact?.email ?? null,
      rescheduledFrom: null,
      rescheduledTo: null,
      canceledBy: null,
      cancelReason: null,
      joinUrl: e.address?.startsWith("http") ? e.address : null,
    };
  });
}
