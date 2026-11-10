import { getFunnel } from "@/lib/berlin/websites";

export const revalidate = 600;

/** Live check for every Bronson website on the Funnel tab: HTTP status and response time. */
export async function GET() {
  const urls = [...new Set((await getFunnel()).flatMap((s) => s.sites.map((x) => x.url)).filter((u) => /^https?:\/\//.test(u)))];
  const results = await Promise.all(
    urls.map(async (url) => {
      const started = Date.now();
      try {
        const res = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000) });
        return { url, status: res.status, ms: Date.now() - started };
      } catch {
        return { url, status: 0, ms: Date.now() - started };
      }
    }),
  );
  return Response.json({ checkedAt: new Date().toISOString(), results });
}
