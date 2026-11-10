import { askClaude } from "@/lib/claude";
import { getBrain } from "@/lib/brain";

/**
 * "Bad copy never ships" (user, 2026-11-10). Two passes: an instant rule scan
 * (banned words, em dashes, banned names) that needs no AI, then a Claude
 * review against the Rules docs + Ad Creative Framework in Skills & Knowledge.
 * Jeremy AI can replace or join the Claude pass once it's connected.
 */
export type Issue = { quote: string; rule: string; severity: "block" | "fix" | "note"; fix: string };
export type CopyCheckResult = {
  verdict: "ship" | "fix" | "block";
  score: number;
  summary: string;
  issues: Issue[];
  rewrite: string;
  ruleHits: Issue[];
  reviewedBy: "claude" | "rules only";
};

const BANNED: { re: RegExp; rule: string; fix: string; severity: Issue["severity"] }[] = [
  { re: /—|–/g, rule: "No em dashes", fix: "Use a comma, period or colon, or start a new short sentence.", severity: "fix" },
  { re: /\bscam(s|my)?\b/gi, rule: "Banned word: scam", fix: "Drop it.", severity: "block" },
  { re: /\bpassive income( machine)?\b/gi, rule: "Banned: passive income", fix: 'Say "the work compounds instead of resetting" or "the revenue stacks on itself".', severity: "block" },
  { re: /\bwebinars?\b/gi, rule: 'Say "masterclass", never "webinar"', fix: "Replace with masterclass.", severity: "fix" },
  { re: /\b(ai )?drop ?shipping\b/gi, rule: "Brand as subscription-based e-commerce, never dropshipping", fix: "Use subscription-based (or MRR) e-commerce.", severity: "fix" },
  { re: /\bguarantee(d|s)?\b/gi, rule: 'No "guaranteed"; guarantee wording must be the 180-day line verbatim', fix: 'Remove, or use: "Make your investment back within 180 days. If you don\'t, we work with you for free until you double your investment."', severity: "fix" },
  { re: /\b(while you sleep|on autopilot|autopilot|push[- ]button|get rich quick|overnight|print money|make a killing|no skills required|spoon[- ]?feed|super easy|get your feet wet|make some money|a couple (of )?dollars|money (from|for) doing nothing)\b/gi, rule: "Banned lazy / get-rich framing", fix: "Cut it; describe the real work and outcome.", severity: "block" },
  { re: /\b(bro|homie|dude)\b/gi, rule: "No bro language", fix: "Cut it; the voice is a genuine young kid.", severity: "fix" },
  { re: /\bad-?ventur\b/gi, rule: "Company name is The Inner Table", fix: "Use The Inner Table.", severity: "fix" },
];

export function ruleScan(text: string): Issue[] {
  const out: Issue[] = [];
  for (const b of BANNED) {
    for (const m of text.matchAll(b.re)) {
      const at = m.index ?? 0;
      out.push({ quote: text.slice(Math.max(0, at - 30), at + m[0].length + 30).replace(/\s+/g, " ").trim(), rule: b.rule, severity: b.severity, fix: b.fix });
    }
  }
  // Paragraphs over 2 sentences (short-lines rule).
  for (const para of text.split(/\n\s*\n/)) {
    const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
    if (sentences.length > 3) out.push({ quote: para.slice(0, 80).replace(/\s+/g, " ") + "…", rule: "Short lines: 1-2 sentences per line", severity: "note", fix: "Break this paragraph into short lines." });
  }
  return out;
}

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ship", "fix", "block"] },
    score: { type: "integer" },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          rule: { type: "string" },
          severity: { type: "string", enum: ["block", "fix", "note"] },
          fix: { type: "string" },
        },
        required: ["quote", "rule", "severity", "fix"],
        additionalProperties: false,
      },
    },
    rewrite: { type: "string" },
  },
  required: ["verdict", "score", "summary", "issues", "rewrite"],
  additionalProperties: false,
} as const;

export async function checkCopy(text: string, kind: string): Promise<CopyCheckResult> {
  const ruleHits = ruleScan(text);
  const docs = await getBrain();
  const rules = docs.filter((d) => d.type === "Rules" || /ad creative framework/i.test(d.title));
  const rulesText = rules.map((d) => `### ${d.title}\n${d.body}`).join("\n\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    const verdict = ruleHits.some((h) => h.severity === "block") ? "block" : ruleHits.length ? "fix" : "ship";
    return { verdict, score: Math.max(0, 100 - ruleHits.length * 10), summary: "Rule scan only (AI review not configured).", issues: [], rewrite: "", ruleHits, reviewedBy: "rules only" };
  }

  const system = `You review marketing copy for Bronson's company, The Inner Table, before it ships. Apply these rules strictly, quoting the exact words that break them:

${rulesText}

Verdict: "block" if anything would hurt the brand or break a hard rule (banned words, invented claims or deliverables, wrong guarantee wording, compliance risk); "fix" if it needs edits but the idea is sound; "ship" only if it's ready as is. Score 0-100 for how ready it is. Also judge: does it sell the outcome rather than the mechanism, speak to a problem-aware lead, and sound like a real person (no polished AI filler)? In "rewrite", return the full corrected copy that keeps the author's idea and voice and fixes every issue, written in short lines with no em dashes. If the verdict is "ship", rewrite may repeat the original.`;

  const r = await askClaude({ system, user: `Type of copy: ${kind || "unspecified"}\n\nCopy to review:\n"""\n${text}\n"""`, schema: SCHEMA as unknown as Record<string, unknown>, effort: "medium" });
  const j = r.json as Omit<CopyCheckResult, "ruleHits" | "reviewedBy"> | null;
  if (!j) {
    const verdict = ruleHits.some((h) => h.severity === "block") ? "block" : ruleHits.length ? "fix" : "ship";
    return { verdict, score: Math.max(0, 100 - ruleHits.length * 10), summary: r.refused ? "The AI review declined this copy; rule scan only." : "AI review failed; rule scan only.", issues: [], rewrite: "", ruleHits, reviewedBy: "rules only" };
  }
  // A hard rule hit always overrides an AI "ship".
  const verdict = ruleHits.some((h) => h.severity === "block") ? "block" : j.verdict === "ship" && ruleHits.some((h) => h.severity === "fix") ? "fix" : j.verdict;
  return { ...j, verdict, ruleHits, reviewedBy: "claude" };
}
