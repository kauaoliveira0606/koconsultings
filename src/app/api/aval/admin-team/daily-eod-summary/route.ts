import { dailyEodSummaryGet } from "@/lib/daily-eod-summary-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = dailyEodSummaryGet("aval");
