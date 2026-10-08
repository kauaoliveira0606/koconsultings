/**
 * Attribution rate per rep, for one period of the Overview's Attribution
 * section. Same formula as the overall rate (purchases the affiliate portal
 * tracked ÷ purchases logged in the Affiliate PCN), split by rep: the portal
 * stamps each sale with the rep's Shared ID, and the PCN names who logged it.
 * The numbers are the Commissions tab's own per-rep figures for that period.
 *
 * The portal only started stamping Shared IDs partway through September 2026.
 * A period from before that has nothing to split, and one that straddles it
 * is counted from that day on (both sides of the division), so the earlier,
 * untagged sales don't drag every rep's rate down.
 */
import type { NextRequest } from "next/server";
import { COMMISSIONS_OFFERS, UNASSIGNED_SHARED_ID, getCommissions } from "@/lib/airtable/commissions";

export type RepAttribution = {
  rep: string;
  /** Portal sales under the rep's Shared ID. */
  tracked: number;
  /** Purchases the rep logged in the Affiliate PCN. */
  logged: number;
  rate: number | null;
};

export type AttributionByRepResponse = {
  reps: RepAttribution[];
  /** Portal sales in the period with no Shared ID on them: tracked, but nobody's. */
  unassigned: number;
  /** First day the portal stamped Shared IDs. */
  trackingStart: string;
  /** First day actually counted: the period's start, or `trackingStart` when that is later. */
  countedFrom: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function attributionByRepGet(offer: keyof typeof COMMISSIONS_OFFERS) {
  return async (request: NextRequest) => {
    const start = request.nextUrl.searchParams.get("start") ?? "";
    const end = request.nextUrl.searchParams.get("end") ?? "";
    if (!DATE.test(start) || !DATE.test(end)) {
      return Response.json({ error: "start and end (YYYY-MM-DD) are required" }, { status: 400 });
    }
    const config = COMMISSIONS_OFFERS[offer];
    const countedFrom = start < config.sharedIdTrackingStart ? config.sharedIdTrackingStart : start;
    const commissions = await getCommissions(config, { start: countedFrom, end });
    const isUnassigned = (rep: string) => rep.toLowerCase() === UNASSIGNED_SHARED_ID.toLowerCase();
    const reps = commissions.lowTicket
      .filter((r) => !isUnassigned(r.rep) && (r.trackedSales > 0 || r.submittedSales > 0))
      .map((r) => ({
        rep: r.rep,
        tracked: r.trackedSales,
        logged: r.submittedSales,
        rate: r.attributionRate,
      }))
      .sort((a, b) => b.logged - a.logged || b.tracked - a.tracked || a.rep.localeCompare(b.rep));
    return Response.json({
      reps,
      unassigned: commissions.lowTicket
        .filter((r) => isUnassigned(r.rep))
        .reduce((t, r) => t + r.trackedSales, 0),
      trackingStart: commissions.sharedIdTrackingStart,
      countedFrom,
    } satisfies AttributionByRepResponse);
  };
}
