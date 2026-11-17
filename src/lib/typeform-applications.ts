import { toEasternDateOnly } from "@/lib/date-range";

/** Bronson's two application forms: the /application page and the home page. */
const APPLICATION_FORMS = ["E5NzxcXh", "IUYQeIuA"];

export type ApplicationRow = { email: string; date: string };

async function formResponses(form: string, token: string): Promise<ApplicationRow[]> {
  const out: ApplicationRow[] = [];
  let before: string | null = null;
  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://api.typeform.com/forms/${form}/responses`);
    url.searchParams.set("page_size", "1000");
    url.searchParams.set("completed", "true");
    if (before) url.searchParams.set("before", before);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Typeform ${form}: ${res.status}`);
    const body = (await res.json()) as {
      items: { token: string; submitted_at?: string; answers?: { type: string; email?: string }[] }[];
    };
    for (const item of body.items) {
      const email = item.answers?.find((a) => a.type === "email")?.email?.trim().toLowerCase();
      const date = toEasternDateOnly(item.submitted_at);
      if (email && date) out.push({ email, date });
    }
    if (body.items.length < 1000) break;
    before = body.items[body.items.length - 1].token;
  }
  return out;
}

/**
 * Completed Typeform applications (user, 2026-11-16: application rate for the
 * Webinars tab, same formula as booking rate). Returns [] if the token is
 * missing or Typeform errors, so the tab still loads.
 */
export async function getApplications(): Promise<ApplicationRow[]> {
  const token = process.env.TYPEFORM_TOKEN;
  if (!token) return [];
  try {
    return (await Promise.all(APPLICATION_FORMS.map((f) => formResponses(f, token)))).flat();
  } catch {
    return [];
  }
}
