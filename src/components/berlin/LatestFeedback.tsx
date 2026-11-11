"use client";

import useSWR from "swr";
import { Sparkles } from "lucide-react";
import { Panel } from "@/components/berlin/Berlin";
import { Markdown } from "@/components/berlin/Markdown";
import type { Feedback } from "@/lib/jeremy-feedback";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Today's Jeremy AI feedback at the top of Overview (hidden until there is one). */
export function LatestFeedback() {
  const { data } = useSWR<{ feedback: Feedback[] }>("/api/bronson/feedback", fetcher, { refreshInterval: 600_000 });
  const f = (Array.isArray(data?.feedback) ? data!.feedback : []).find((x) => x.type === "daily");
  if (!f) return null;
  return (
    <Panel className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--text-strong)]"><Sparkles size={15} /> Jeremy AI · {f.date}</div>
        <a href="/bronson/feedback" className="text-[12px] font-semibold text-[var(--accent)]">All feedback</a>
      </div>
      <div className="max-h-72 overflow-y-auto pr-2"><Markdown source={f.feedback} /></div>
    </Panel>
  );
}
