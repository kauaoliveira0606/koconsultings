import { askClaudeWithTools, type LocalTool } from "@/lib/claude";
import { getBrain, searchBrain } from "@/lib/brain";
import { checkCopy } from "@/lib/copy-check";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";
import { snapshotText } from "@/lib/berlin-snapshot";
import { getOffice, setTaskStatus, AI_ASSIGNEE, type Task } from "@/lib/office";

/**
 * The AI queue worker (user, 2026-11-11: nothing was picking up "Queued for AI"
 * tasks). Hourly in the day it takes the next AI task, works it with Claude
 * (following the SOP from Skills & Knowledge, running the copy check on any copy,
 * asking Jeremy AI for marketing judgment, seeing the live numbers), and puts the
 * finished work in Review. A denied task comes back with the note and is redone.
 */
const PRIORITY = { High: 0, Normal: 1, Low: 2 } as const;

export function nextTask(tasks: Task[]): Task | null {
  return (
    tasks
      .filter((t) => !t.done && t.assignee === AI_ASSIGNEE && t.status === "Up Next")
      .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])[0] ?? null
  );
}

function tools(): LocalTool[] {
  const list: LocalTool[] = [
    {
      name: "search_knowledge",
      description: "Search Skills & Knowledge (skills, SOPs, Bronson copy rules, processes, ad formats). Do this first: find the SOP or skill for the task and follow it.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: async (i) => JSON.stringify(searchBrain(await getBrain(), String(i.query ?? ""), 6)),
    },
    {
      name: "get_knowledge",
      description: "Read one Skills & Knowledge document in full by id or exact title.",
      input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      run: async (i) => {
        const key = String(i.id ?? "").toLowerCase();
        const docs = await getBrain();
        const d = docs.find((x) => x.id.toLowerCase() === key || x.title.toLowerCase() === key) ?? docs.find((x) => x.title.toLowerCase().includes(key));
        return d ? `# ${d.title}\n\n${d.body}` : "No document matches.";
      },
    },
    {
      name: "check_copy",
      description: "Check copy before it ships (banned words + review against the Bronson rules). Returns ship / fix / block, problems and a fixed version. Run it on every piece of copy you write, and fix until it ships.",
      input_schema: { type: "object", properties: { text: { type: "string" }, kind: { type: "string" } }, required: ["text"] },
      run: async (i) => {
        const r = await checkCopy(String(i.text ?? ""), String(i.kind ?? ""));
        return JSON.stringify({ verdict: r.verdict, score: r.score, summary: r.summary, issues: [...r.ruleHits, ...r.issues].slice(0, 15), fixed: r.rewrite });
      },
    },
  ];
  if (jeremyConfigured()) {
    list.push({
      name: "ask_jeremy",
      description: "Ask Jeremy AI (the operator's marketing expert) for judgment on strategy, offers, funnels, ads or copy. Give it the context it needs in the message.",
      input_schema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      run: async (i) => (await askJeremy(String(i.message ?? ""), null, 150_000)).text,
    });
  }
  return list;
}

const SYSTEM = `You are Berlin's AI worker for Bronson's company, The Inner Table (subscription-based e-commerce coaching sold through a live masterclass funnel: Meta ads -> masterclass registration -> live masterclass -> booked call -> high ticket close).

You get one task from the Office AI queue. Do it completely, the way a great marketing operator would:
1. search_knowledge for the SOP, skill or rules that cover the task, and follow them.
2. Use the live numbers provided when the task is about performance.
3. Write the actual deliverable (scripts, copy, analysis, plan), not a description of what you would do.
4. Run check_copy on every piece of copy and fix it until it ships. Never use em dashes. Follow the Bronson copy rules.
5. Ask Jeremy AI when a marketing judgment call matters.

You can't touch ad accounts, websites or other systems. If the task needs that, do everything up to it and list exactly what a person must do.

Reply in markdown with: **Done:** one line, then the deliverable, then **For you to do:** (only if a person must act). If the task truly can't be done without missing information, start your reply with "BLOCKED:" and say exactly what's needed.`;

export async function runWorker(): Promise<{ ok: boolean; task?: string; status?: string; reason?: string }> {
  const { tasks } = await getOffice();
  const task = nextTask(tasks);
  if (!task) return { ok: true, reason: "Queue empty" };
  await setTaskStatus(task.id, "Doing");
  try {
    const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.koconsultings.com";
    const data = await snapshotText(origin).catch(() => "");
    const redo = task.reviewNote.startsWith("Denied") ? `\n\nThis was sent back by the operator. Their note: "${task.reviewNote}". Your previous result:\n${task.result}\n\nRedo it with that feedback.` : "";
    const r = await askClaudeWithTools({
      system: SYSTEM,
      user: `TASK: ${task.task}\n\nDETAILS:\n${task.description || "(none)"}${redo}\n\nLIVE NUMBERS (JSON, rates are percentages):\n${data}`,
      tools: tools(),
      maxTurns: 10,
      budgetMs: 10 * 60_000,
    });
    const text = r.text.trim();
    if (!text) {
      await setTaskStatus(task.id, "Up Next", { result: r.refused ? "The AI declined this task. Reword it or do it by hand." : "The worker ran out of steps; it will try again next run." });
      return { ok: false, task: task.task, reason: "no result" };
    }
    const blocked = text.startsWith("BLOCKED:");
    await setTaskStatus(task.id, blocked ? "Blocked" : "Review", { result: text.slice(0, 95_000) });
    return { ok: true, task: task.task, status: blocked ? "Blocked" : "Review" };
  } catch (err) {
    await setTaskStatus(task.id, "Up Next", { result: `Worker error, will retry: ${err instanceof Error ? err.message : "unknown"}` });
    return { ok: false, task: task.task, reason: err instanceof Error ? err.message : "error" };
  }
}
