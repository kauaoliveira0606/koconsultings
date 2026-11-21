import { getAaronAffiliateEod } from "@/lib/airtable/tables-aaron";
import { setterLeaderboardGet } from "@/lib/setter-leaderboard";

export const revalidate = 60;

export const GET = setterLeaderboardGet("aaron", getAaronAffiliateEod);
