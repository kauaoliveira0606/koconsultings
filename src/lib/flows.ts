import { addTask, getOffice, AI_ASSIGNEE, type Task } from "@/lib/office";

/**
 * "Faster from idea to live" (user, 2026-11-10). One idea becomes a chain of
 * Office AI tasks (research -> script -> ads -> page), each telling Claude which
 * skill and SOP to follow and to run the copy check. Tasks are tagged by title:
 * "Flow · <name> · <n>. <step>", which is how the Launch tab groups them.
 */
export const FLOW_PREFIX = "Flow · ";

type Step = { name: string; brief: string };
export const FLOW_TYPES: Record<string, { label: string; steps: Step[] }> = {
  launch: {
    label: "Full launch (research → script → ads → page)",
    steps: [
      { name: "Research", brief: "Run the market research for this idea: competitors, their claims, buyer language, the angle we can own. Follow the cao-market-research skill (search_knowledge 'market research'). Put a one-page summary with 3 angles in Review." },
      { name: "Script", brief: "Using the approved research, write the core script/copy (masterclass hook, VSL or page copy as fits). Follow cao-copywriter and the relevant SOP (search_knowledge). Run check_copy and fix until it ships. Put it in Review." },
      { name: "Ads", brief: "Write 5 ads from the approved script. Use get_creative_scores for what's working now and get_ad_format for each format. Run check_copy on every ad. Put them in Review." },
      { name: "Page", brief: "Write the landing page (and confirmation page if needed) for this idea. Follow the confirmation page SOP and the Bronson rules. Run check_copy. Put the copy in Review; once approved, it gets built on ad-ventur.com." },
    ],
  },
  ads: {
    label: "Ad batch (research angle → 5 ads)",
    steps: [
      { name: "Angle", brief: "Pull get_creative_scores and get_campaigns_and_ads; pick the angle and formats for this batch based on what's winning. Put a short brief in Review." },
      { name: "Ads", brief: "Write 5 ads from the approved brief using get_ad_format. Run check_copy on each. Put them in Review." },
    ],
  },
  page: {
    label: "New page (script → page)",
    steps: [
      { name: "Script", brief: "Write the page copy for this idea following the relevant SOP (search_knowledge) and the Bronson rules. Run check_copy. Put it in Review." },
      { name: "Page", brief: "Turn the approved copy into the page on ad-ventur.com in the light Bronson style, then share the link in Review." },
    ],
  },
};

export async function startFlow(name: string, idea: string, type: keyof typeof FLOW_TYPES) {
  const def = FLOW_TYPES[type] ?? FLOW_TYPES.launch;
  const ids: (string | null)[] = [];
  for (const [i, step] of def.steps.entries()) {
    ids.push(
      await addTask({
        task: `${FLOW_PREFIX}${name} · ${i + 1}. ${step.name}`,
        description: `Idea: ${idea}\n\nStep ${i + 1} of ${def.steps.length}: ${step.brief}${i > 0 ? `\n\nStart only after step ${i} ("${def.steps[i - 1].name}") is approved; build on its result.` : ""}`,
        department: "Marketing",
        role: "AI",
        assignee: AI_ASSIGNEE,
        status: i === 0 ? "Up Next" : "Blocked",
        priority: "High",
      }),
    );
  }
  return ids;
}

export type Flow = { name: string; steps: { n: number; step: string; task: Task }[]; done: number };

export async function getFlows(): Promise<Flow[]> {
  const { tasks } = await getOffice();
  const map = new Map<string, Flow>();
  for (const t of tasks) {
    if (!t.task.startsWith(FLOW_PREFIX)) continue;
    const m = t.task.slice(FLOW_PREFIX.length).match(/^(.*) · (\d+)\. (.*)$/);
    if (!m) continue;
    const f = map.get(m[1]) ?? { name: m[1], steps: [], done: 0 };
    f.steps.push({ n: Number(m[2]), step: m[3], task: t });
    map.set(m[1], f);
  }
  return [...map.values()]
    .map((f) => ({ ...f, steps: f.steps.sort((a, b) => a.n - b.n), done: f.steps.filter((s) => s.task.done).length }))
    .sort((a, b) => a.done / a.steps.length - b.done / b.steps.length);
}
