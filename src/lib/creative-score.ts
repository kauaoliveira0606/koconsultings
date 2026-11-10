import type { AdsEntity } from "@/lib/ads-cortana";

/**
 * "Creative testing that compounds" (user, 2026-11-10). Each ad is scored piece
 * by piece against the KPI lines: Hook (hook rate), Body (hold rate), CTA (link
 * CTR) and Result (cost per complete registration). On a line's "good" value a
 * piece scores 80, on its "bad" value 40, straight line between, clamped 0-100.
 */
type Line = { good: number; bad: number; higherIsBetter: boolean };
const LINES: Record<"hook" | "body" | "cta" | "result", Line> = {
  hook: { good: 0.3, bad: 0.2, higherIsBetter: true },
  body: { good: 0.25, bad: 0.15, higherIsBetter: true },
  cta: { good: 0.02, bad: 0.005, higherIsBetter: true },
  result: { good: 10, bad: 12, higherIsBetter: false },
};
const WEIGHTS = { hook: 0.25, body: 0.2, cta: 0.2, result: 0.35 };
export const MIN_SPEND = 30;

function pieceScore(v: number | null, l: Line): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const t = l.higherIsBetter ? (v - l.bad) / (l.good - l.bad) : (l.bad - v) / (l.bad - l.good);
  return Math.max(0, Math.min(100, Math.round(40 + t * 40)));
}

export type Piece = "hook" | "body" | "cta" | "result";
export type CreativeScore = {
  entityId: string;
  name: string;
  spend: number;
  registrations: number;
  costPerReg: number | null;
  booked: number;
  htRevenue: number;
  pieces: Record<Piece, { value: number | null; score: number | null }>;
  score: number | null;
  verdict: "Scale" | "Fix the hook" | "Fix the body" | "Fix the CTA" | "Kill" | "Not enough spend";
  why: string;
  testNext: string;
};

const PIECE_LABEL: Record<Piece, string> = { hook: "hook", body: "body (hold)", cta: "call to action (click)", result: "cost per registration" };
const TEST_NEXT: Record<Piece, string> = {
  hook: "Keep the body and CTA, test 3 new openings (first 3 seconds): a pattern interrupt, a bold claim, and a question. See the hook types in Ad formats.",
  body: "Keep the hook, tighten the middle: cut to the strongest proof in the first 10 seconds, shorter cuts, one idea per line.",
  cta: "Keep the hook and body, rewrite the ask: say exactly what they get at the masterclass and why now. Test a caption CTA plus an on-screen CTA.",
  result: "Creative metrics are fine but registrations are expensive: test the landing page headline and the audience before touching the ad.",
};

export function scoreCreatives(ads: AdsEntity[]): CreativeScore[] {
  return ads
    .filter((a) => a.spend > 0)
    .map((a) => {
      const pieces = {
        hook: { value: a.hookRate, score: pieceScore(a.hookRate, LINES.hook) },
        body: { value: a.holdRate, score: pieceScore(a.holdRate, LINES.body) },
        cta: { value: a.linkCtr, score: pieceScore(a.linkCtr, LINES.cta) },
        result: { value: a.costPerOptIn, score: a.registrations === 0 && a.spend >= MIN_SPEND ? 0 : pieceScore(a.costPerOptIn, LINES.result) },
      };
      const scored = (Object.keys(WEIGHTS) as Piece[]).filter((p) => pieces[p].score !== null);
      const weight = scored.reduce((s, p) => s + WEIGHTS[p], 0);
      const score = weight ? Math.round(scored.reduce((s, p) => s + (pieces[p].score as number) * WEIGHTS[p], 0) / weight) : null;
      const weakest = scored
        .filter((p) => p !== "result")
        .sort((x, y) => (pieces[x].score as number) - (pieces[y].score as number))[0];

      let verdict: CreativeScore["verdict"];
      let why: string;
      let testNext: string;
      if (a.spend < MIN_SPEND) {
        verdict = "Not enough spend";
        why = `Only $${a.spend.toFixed(0)} spent; needs $${MIN_SPEND}+ to judge.`;
        testNext = "Let it spend before judging.";
      } else if ((pieces.result.score ?? 0) >= 70 && (score ?? 0) >= 65) {
        verdict = "Scale";
        why = `Registrations at $${a.costPerOptIn?.toFixed(2)} and the creative holds up.`;
        testNext = "Scale budget 20% and make 2 variations of this exact ad (same hook, new visuals) for the next batch.";
      } else if (((score ?? 0) < 35 || (pieces.result.score ?? 100) === 0) && a.htRevenue === 0 && a.booked < 2) {
        verdict = "Kill";
        why =
          a.registrations === 0
            ? `$${a.spend.toFixed(0)} spent with no registrations.`
            : (pieces.result.score ?? 100) === 0
              ? `Registrations cost $${(a.costPerOptIn ?? 0).toFixed(2)}, far over the $12 line, and no calls or sales came from it.`
              : `Weak across the board (score ${score}).`;
        testNext = "Turn it off. Don't iterate; start the next one from a winning format.";
      } else {
        const p = weakest ?? "result";
        verdict = p === "hook" ? "Fix the hook" : p === "body" ? "Fix the body" : p === "cta" ? "Fix the CTA" : "Fix the hook";
        // An ad that books calls or closes is improved, never killed (user's numbers, 2026-11-10).
        const backEnd = a.htRevenue > 0 || a.booked >= 2;
        const cost = a.costPerOptIn !== null ? `$${a.costPerOptIn.toFixed(2)}` : "too much";
        const closed = a.htRevenue ? ` and closed $${a.htRevenue.toFixed(0)}` : "";
        why = backEnd
          ? `Registrations cost ${cost}, but it booked ${a.booked} call${a.booked === 1 ? "" : "s"}${closed}, so improve it, don't kill it. Weakest piece is the ${PIECE_LABEL[p]}.`
          : `Weakest piece is the ${PIECE_LABEL[p]}.`;
        testNext = TEST_NEXT[p];
      }
      return {
        entityId: a.entityId,
        name: a.name,
        spend: a.spend,
        registrations: a.registrations,
        costPerReg: a.costPerOptIn,
        booked: a.booked,
        htRevenue: a.htRevenue,
        pieces,
        score,
        verdict,
        why,
        testNext,
      };
    })
    .sort((x, y) => (y.score ?? -1) - (x.score ?? -1) || y.spend - x.spend);
}

/** Brief for the AI queue: build the next batch from what this one taught. */
export function nextBatchBrief(scores: CreativeScore[], rangeLabel: string): string {
  const judged = scores.filter((s) => s.verdict !== "Not enough spend");
  const fmt = (s: CreativeScore) =>
    `- ${s.name} | score ${s.score} | $${s.spend.toFixed(0)} spent | ${s.registrations} reg at ${s.costPerReg !== null ? `$${s.costPerReg.toFixed(2)}` : "n/a"} | hook ${s.pieces.hook.score ?? "-"} body ${s.pieces.body.score ?? "-"} CTA ${s.pieces.cta.score ?? "-"} | ${s.verdict}`;
  const winners = judged.filter((s) => s.verdict === "Scale");
  const fixes = judged.filter((s) => s.verdict.startsWith("Fix"));
  const kills = judged.filter((s) => s.verdict === "Kill");
  return [
    `Creative results for ${rangeLabel}. Build the next batch of 5 ads from these, then put the scripts in Review.`,
    "",
    "Winners (make variations, keep the hook):",
    ...(winners.length ? winners.map(fmt) : ["- none yet"]),
    "",
    "Fix one piece (keep what works, change only the weak piece):",
    ...(fixes.length ? fixes.map((s) => `${fmt(s)}\n  Test next: ${s.testNext}`) : ["- none"]),
    "",
    "Kill (don't iterate):",
    ...(kills.length ? kills.map(fmt) : ["- none"]),
    "",
    "Before writing: search_knowledge for the Ad Creative Framework and the Bronson copy rules, and use get_ad_format for the format of each winner. Every script must pass the Bronson copy rules.",
  ].join("\n");
}
