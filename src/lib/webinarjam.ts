/**
 * WebinarJam registrants, read from its API (`/webinarjam/registrants`, 25 a
 * page). Each row is one person for one session.
 */

const WEBINARJAM_API = "https://api.webinarjam.com/webinarjam";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Registrant = {
  id: number;
  event_id: number;
  email: string | null;
  event: string;
  attended_live: string;
  date_live: string;
  time_live: string;
  utm_campaign: string | null;
};

export type WebinarJamRegistrant = {
  key: string;
  email: string;
  /** YYYY-MM-DD of the session; attendees are dated by the day they watched live. */
  sessionDate: string | null;
  stage: "Registered" | "No Show" | "Attended" | "Stayed Until Pitch";
  /** The sign-up carried an ad campaign UTM. */
  paidSignup: boolean;
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

/**
 * Every registrant of one webinar. Stayed until pitch = watched live 1 hour or
 * more (user's rule); a session that has passed without them attending is a
 * no show. WebinarJam sometimes moves a live attendee's row on to the next
 * session but keeps their attendance, so attendees take the day they watched.
 */
export async function getWebinarJamRegistrants(apiKey: string, webinarId: string, today: string): Promise<WebinarJamRegistrant[]> {
  const rows: Registrant[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${WEBINARJAM_API}/registrants?${new URLSearchParams({ api_key: apiKey, webinar_id: webinarId, page: String(page) })}`,
      { method: "POST", headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`WebinarJam registrants failed (${res.status})`);
    const { registrants } = (await res.json()) as {
      registrants: { data: Registrant[]; current_page: number; last_page: number };
    };
    rows.push(...registrants.data);
    if (registrants.current_page >= registrants.last_page) break;
  }
  return rows
    .filter((r) => !!r.email)
    .map((r) => {
      const attended = String(r.attended_live).toLowerCase() === "yes";
      const sessionDate = (attended && toDay(r.date_live)) || toDay(r.event);
      const stage: WebinarJamRegistrant["stage"] = attended
        ? seconds(r.time_live) >= 3600
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
      };
    });
}
