import { getAvalAffiliateEod } from "@/lib/airtable/tables-aval";
import { setterLeaderboardGet } from "@/lib/setter-leaderboard";

export const revalidate = 60;

export const GET = setterLeaderboardGet("aval", getAvalAffiliateEod);
