/**
 * WebinarJam registrants, read from its API (`/webinarjam/registrants`, 25 a
 * page). Each row is one person for one session.
 *
 * Sessions come from `schedule_id` (user, 2026-11-04: break registrants down
 * by session). WebinarJam sometimes moves a row's `event` on to the next
 * session, but `schedule_id` stays the session the person signed up for and
 * watched, so it is the one to group by.
 *
 * Live room behavior: `entered_live` is how far into the session they came in,
 * `time_live` how long they stayed, so they were in the room from
 * entered_live to entered_live + time_live.
 */

const WEBINARJAM_API = "https://api.webinarjam.com/webinarjam";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Registrant = {
  id: number;
  event_id: number;
  schedule_id: number | null;
  email: string | null;
  event: string;
  attended_live: string;
  entered_live: string;
  time_live: string;
  utm_campaign: string | null;
};

export type WebinarJamRegistrant = {
  key: string;
  email: string;
  /** YYYY-MM-DD of the session (from its schedule_id). */
  sessionDate: string | null;
  stage: "Registered" | "No Show" | "Attended" | "Stayed Until Pitch";
  /** The sign-up carried an ad campaign UTM. */
  paidSignup: boolean;
  /** Seconds into the session they came into the live room; null if they never did. */
  enteredAt: number | null;
  /** Seconds into the session they left the live room; null if they never came in. */
  leftAt: number | null;
};

/** "Sun, 18 Oct 2026, 07:00 PM" -> "2026-10-18" */
function toDay(s: string | null | undefined): string | null {
  const m = String(s ?? "").match(/(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  return month < 0 ? null : `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const seconds = (t: string) => {
  const p = String(t || "0:0:0").split(":").map(Number);
  return p.length === 3 && p.every((n) => !Number.isNaN(n)) ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
};

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${WEBINARJAM_API}/${path}?${new URLSearchParams(params)}`, {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WebinarJam ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

/** schedule_id -> session day ("2026-11-04"), from the webinar's schedules. */
async function sessionDays(apiKey: string, webinarId: string): Promise<Map<number, string>> {
  const { webinar } = await call<{ webinar: { schedules?: { date: string; schedule: number }[] } }>("webinar", {
    api_key: apiKey,
    webinar_id: webinarId,
  });
  return new Map((webinar.schedules ?? []).map((s) => [Number(s.schedule), s.date.slice(0, 10)]));
}

/** True when the person was in the live room at the pitch minute. */
export function inRoomAt(r: { enteredAt: number | null; leftAt: number | null }, at: number): boolean {
  return r.enteredAt !== null && r.leftAt !== null && r.enteredAt <= at && r.leftAt > at;
}

/**
 * Every registrant of one webinar. Stayed until pitch = in the live room at
 * the pitch minute (`pitchAtSeconds`). A session that has passed without them
 * attending is a no show.
 */
export async function getWebinarJamRegistrants(
  apiKey: string,
  webinarId: string,
  today: string,
  pitchAtSeconds: number,
): Promise<WebinarJamRegistrant[]> {
  const rows: Registrant[] = [];
  const daysPromise = sessionDays(apiKey, webinarId);
  for (let page = 1; ; page++) {
    const { registrants } = await call<{ registrants: { data: Registrant[]; current_page: number; last_page: number } }>(
      "registrants",
      { api_key: apiKey, webinar_id: webinarId, page: String(page) },
    );
    rows.push(...registrants.data);
    if (registrants.current_page >= registrants.last_page) break;
  }
  const days = await daysPromise;
  return rows
    .filter((r) => !!r.email && !/^zz-test-/i.test(r.email))
    .map((r) => {
      const attended = String(r.attended_live).toLowerCase() === "yes";
      const sessionDate = (r.schedule_id !== null && days.get(Number(r.schedule_id))) || toDay(r.event);
      const enteredAt = attended ? seconds(r.entered_live) : null;
      const leftAt = attended ? enteredAt! + seconds(r.time_live) : null;
      const stage: WebinarJamRegistrant["stage"] = attended
        ? inRoomAt({ enteredAt, leftAt }, pitchAtSeconds)
          ? "Stayed Until Pitch"
          : "Attended"
        : sessionDate && sessionDate < today
          ? "No Show"
          : "Registered";
      return {
        key: `${r.id}:${r.event_id}`,
        email: r.email!.trim().toLowerCase(),
        sessionDate,
        stage,
        paidSignup: !!(r.utm_campaign ?? "").trim(),
        enteredAt,
        leftAt,
      };
    });
}
