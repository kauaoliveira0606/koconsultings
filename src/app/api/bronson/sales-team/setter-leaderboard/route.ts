import { getBronsonAffiliateEod } from "@/lib/airtable/tables";
import { setterLeaderboardGet } from "@/lib/setter-leaderboard";

export const revalidate = 60;

export const GET = setterLeaderboardGet("bronson", getBronsonAffiliateEod);
