import type { NextRequest } from "next/server";
import { askClaude } from "@/lib/claude";
import { getBrain, searchBrain } from "@/lib/brain";
import { snapshot } from "@/lib/berlin-snapshot";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * "An AI that reads your numbers" (user, 2026-11-10): the Ask Berlin box.
 * Each question is answered from a fresh snapshot of the live numbers plus the
 * most relevant Skills & Knowledge docs. Jeremy AI can be added as a second
 * brain here once it's connected.
 */
type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { question?: string; history?: Turn[]; page?: string };
  const question = String(b.question ?? "").trim();
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "The AI isn't configured on this server." }, { status: 500 });

  const origin = new URL(request.url).origin;
  const [data, docs] = await Promise.all([snapshot(origin), getBrain()]);
  const hits = searchBrain(docs, question, 3);
  const knowledge = hits
    .map((h) => docs.find((d) => d.id === h.id))
    .filter(Boolean)
    .map((d) => `### ${d!.title}\n${d!.body.slice(0, 6000)}`)
    .join("\n\n");
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((t) => `${t.role === "user" ? "Q" : "A"}: ${String(t.content).slice(0, 2000)}`).join("\n");
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const system = `You are Berlin, the analyst inside Bronson's marketing dashboard (The Inner Table, a subscription-based e-commerce coaching offer sold through a live masterclass funnel: Meta ads -> masterclass registration -> live masterclass -> booked call -> high ticket close). Answer the operator's question from the live data below. Be direct and specific: name the campaign, ad set or ad, quote the numbers, and say what to do next. Short paragraphs or a few bullets. If the data doesn't answer it, say exactly what's missing instead of guessing.

KPI lines: cost per complete registration $10 good / over $12 bad; opt-in rate 30% good / under 20% bad; hook rate 30%; hold rate 25% good / under 15% bad; link CTR 2% good / under 0.5% bad; CPM under $20 good / over $80 bad; frequency under 2 good / over 3.5 bad; ROAS goal 3x. Rates below are percentages. Today's ad spend updates through the day.

Current time: ${now} ET. Page the operator is on: ${b.page ?? "unknown"}.

LIVE DATA (JSON):
${JSON.stringify(data)}

${knowledge ? `RELEVANT SOPs FROM SKILLS & KNOWLEDGE:\n${knowledge}` : ""}`;

  const user = history ? `Earlier in this chat:\n${history}\n\nQuestion: ${question}` : question;
  try {
    const r = await askClaude({ system, user, effort: "medium" });
    if (r.refused) return Response.json({ answer: "I can't answer that one. Try asking it a different way." });
    return Response.json({ answer: r.text, sources: hits.map((h) => h.title) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "The AI request failed" }, { status: 500 });
  }
}
