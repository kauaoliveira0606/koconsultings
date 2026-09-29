/**
 * Live view of the sales calls booked on a Calendly org: every booking from
 * now through the next few days, including cancels and reschedules, with
 * calls dropped as soon as they end. Read straight from Calendly's API on
 * every request, so it's as current as the calendar itself.
 */

const CALENDLY_API = "https://api.calendly.com";

export type LiveCallStatus = "scheduled" | "live" | "canceled" | "rescheduled";

export type LiveCall = {
  id: string;
  eventName: string;
  start: string;
  end: string;
  host: string | null;
  status: LiveCallStatus;
  inviteeName: string | null;
  inviteeEmail: string | null;
  /** Active booking that replaced an earlier one. */
  rescheduledFrom: string | null;
  /** Canceled booking that was moved: the new start time. */
  rescheduledTo: string | null;
  canceledBy: string | null;
  cancelReason: string | null;
  joinUrl: string | null;
};

export type LiveCallsResponse = {
  calls: LiveCall[];
  fetchedAt: string;
};

type CalendlyEvent = {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_memberships: { user_name?: string }[];
  location?: { join_url?: string; location?: string } | null;
  cancellation?: { canceler_type?: string; reason?: string } | null;
};

type CalendlyInvitee = {
  name: string | null;
  email: string | null;
  status: "active" | "canceled";
  rescheduled: boolean;
  new_invitee: string | null;
  old_invitee: string | null;
  cancellation?: { canceler_type?: string; reason?: string } | null;
};

async function calendlyGet<T>(pat: string, url: string): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${CALENDLY_API}${url}`, {
    headers: { Authorization: `Bearer ${pat}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Calendly request failed (${res.status}) for ${url}`);
  return res.json() as Promise<T>;
}

async function listEvents(pat: string, organization: string, min: string, max: string) {
  const events: CalendlyEvent[] = [];
  let next: string | null =
    `/scheduled_events?${new URLSearchParams({
      organization,
      min_start_time: min,
      max_start_time: max,
      count: "100",
      sort: "start_time:asc",
    })}`;
  while (next) {
    const page: { collection: CalendlyEvent[]; pagination: { next_page: string | null } } =
      await calendlyGet(pat, next);
    events.push(...page.collection);
    next = page.pagination.next_page;
  }
  return events;
}

/** `.../scheduled_events/{uuid}/invitees/{uuid}` → `.../scheduled_events/{uuid}` */
function eventUriOfInvitee(inviteeUri: string): string {
  return inviteeUri.replace(/\/invitees\/[^/]+$/, "");
}

export async function getLiveCalls({
  pat,
  organization,
  isSalesCall,
  days = 7,
}: {
  pat: string;
  organization: string;
  isSalesCall: (eventName: string) => boolean;
  days?: number;
}): Promise<LiveCallsResponse> {
  const now = new Date();
  // Look back far enough to catch calls already in progress.
  const min = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const max = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const events = (await listEvents(pat, organization, min, max)).filter(
    (e) => isSalesCall(e.name) && new Date(e.end_time) > now
  );

  const calls = await Promise.all(
    events.map(async (e): Promise<LiveCall> => {
      const { collection: invitees } = await calendlyGet<{ collection: CalendlyInvitee[] }>(
        pat,
        `${e.uri}/invitees?count=100`
      );
      const invitee = invitees[0] ?? null;

      let status: LiveCallStatus =
        e.status === "canceled"
          ? invitee?.rescheduled
            ? "rescheduled"
            : "canceled"
          : new Date(e.start_time) <= now
            ? "live"
            : "scheduled";

      let rescheduledTo: string | null = null;
      if (status === "rescheduled" && invitee?.new_invitee) {
        const { resource } = await calendlyGet<{ resource: CalendlyEvent }>(
          pat,
          eventUriOfInvitee(invitee.new_invitee)
        ).catch(() => ({ resource: null as CalendlyEvent | null }));
        rescheduledTo = resource?.start_time ?? null;
      }
      if (status === "rescheduled" && !invitee?.new_invitee) status = "canceled";

      let rescheduledFrom: string | null = null;
      if (e.status === "active" && invitee?.old_invitee) {
        const { resource } = await calendlyGet<{ resource: CalendlyEvent }>(
          pat,
          eventUriOfInvitee(invitee.old_invitee)
        ).catch(() => ({ resource: null as CalendlyEvent | null }));
        rescheduledFrom = resource?.start_time ?? null;
      }

      const cancellation = invitee?.cancellation ?? e.cancellation ?? null;
      return {
        id: e.uri.split("/").pop() ?? e.uri,
        eventName: e.name,
        start: e.start_time,
        end: e.end_time,
        host: e.event_memberships[0]?.user_name ?? null,
        status,
        inviteeName: invitee?.name ?? null,
        inviteeEmail: invitee?.email ?? null,
        rescheduledFrom,
        rescheduledTo,
        canceledBy: e.status === "canceled" ? cancellation?.canceler_type ?? null : null,
        cancelReason: e.status === "canceled" ? cancellation?.reason || null : null,
        joinUrl: e.location?.join_url ?? null,
      };
    })
  );

  return { calls, fetchedAt: now.toISOString() };
}
