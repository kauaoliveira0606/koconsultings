import { getStoredAlerts } from "@/lib/ad-alerts";
import { getBrain, metricTagsFor, sopsFor } from "@/lib/brain";

export const dynamic = "force-dynamic";

/** Active ad alerts for the Overview / Ads banner. */
export async function GET() {
  const docs = await getBrain();
  const sopFor = (title: string) => {
    for (const t of metricTagsFor(title)) {
      const d = sopsFor(docs, t)[0];
      if (d) return { id: d.id, title: d.title };
    }
    return null;
  };
  const alerts = (await getStoredAlerts())
    .filter((a) => a.active)
    .sort((a, b) => (a.level === b.level ? b.lastSeen.localeCompare(a.lastSeen) : a.level === "red" ? -1 : 1))
    .map(({ key, level, title, detail, firstAt }) => ({ key, level, title, detail, firstAt, sop: sopFor(title) }));
  return Response.json({ alerts });
}
