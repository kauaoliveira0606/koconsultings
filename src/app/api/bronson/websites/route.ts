import { WEBSITE_GROUPS, siteUrl } from "@/lib/berlin/websites";

export const revalidate = 600;

/** Live check for every Bronson website: HTTP status and response time. */
export async function GET() {
  const sites = WEBSITE_GROUPS.flatMap((g) => g.sites.map(siteUrl));
  const results = await Promise.all(
    sites.map(async (url) => {
      const started = Date.now();
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000) });
        return { url, status: res.status, ms: Date.now() - started };
      } catch {
        return { url, status: 0, ms: Date.now() - started };
      }
    }),
  );
  return Response.json({ checkedAt: new Date().toISOString(), results });
}
