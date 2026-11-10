import { getStoredAlerts } from "@/lib/ad-alerts";

export const dynamic = "force-dynamic";

/** Active ad alerts for the Overview / Ads banner. */
export async function GET() {
  const alerts = (await getStoredAlerts())
    .filter((a) => a.active)
    .sort((a, b) => (a.level === b.level ? b.lastSeen.localeCompare(a.lastSeen) : a.level === "red" ? -1 : 1))
    .map(({ key, level, title, detail, firstAt }) => ({ key, level, title, detail, firstAt }));
  return Response.json({ alerts });
}
