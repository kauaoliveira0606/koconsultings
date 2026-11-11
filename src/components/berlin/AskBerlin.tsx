"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Sparkles, X, Send, MessageCircle } from "lucide-react";
import { Markdown } from "@/components/berlin/Markdown";

type Turn = { role: "user" | "assistant"; content: string; sources?: string[] };
type Who = "jeremy" | "berlin";

const STARTERS: Record<Who, string[]> = {
  jeremy: [
    "Review today's numbers and tell me what to fix first.",
    "Which ads should I scale, fix or kill, and why?",
    "Write 3 new hooks for our best ad.",
    "What's the weakest step in our funnel right now?",
  ],
  berlin: ["How are we pacing today versus yesterday?", "Why is cost per registration up?", "Which ad made the most sales this month?"],
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Open the assistant from anywhere: window.dispatchEvent(new CustomEvent("berlin:ask", { detail: { to: "jeremy", message } })) */
export function askAssistant(message: string, to: Who = "jeremy") {
  window.dispatchEvent(new CustomEvent("berlin:ask", { detail: { to, message } }));
}

/** Chat pop-up on every admin tab: Jeremy AI (marketing brain, reads Berlin itself) or Berlin (fast answers from the numbers). */
export function AskBerlin() {
  const pathname = usePathname();
  const { data: status } = useSWR<{ connected: boolean }>("/api/bronson/jeremy", fetcher);
  const jeremyOn = Boolean(status?.connected);
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Who>("jeremy");
  const [turns, setTurns] = useState<Record<Who, Turn[]>>({ jeremy: [], berlin: [] });
  const [conv, setConv] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const active: Who = who === "jeremy" && !jeremyOn ? "berlin" : who;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy, active]);

  async function ask(question: string, target: Who = active) {
    const text = question.trim();
    if (!text || busy) return;
    const history = turns[target].map(({ role, content }) => ({ role, content }));
    setTurns((t) => ({ ...t, [target]: [...t[target], { role: "user", content: text }] }));
    setQ("");
    setBusy(true);
    try {
      const r =
        target === "jeremy"
          ? await fetch("/api/bronson/jeremy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, conversationId: conv, page: pathname }) })
          : await fetch("/api/bronson/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, history, page: pathname }) });
      const j = await r.json();
      if (target === "jeremy" && j.conversationId) setConv(j.conversationId);
      setTurns((t) => ({ ...t, [target]: [...t[target], { role: "assistant", content: r.ok ? j.answer : `Sorry, that failed: ${j.error ?? r.status}`, sources: j.sources }] }));
    } catch {
      setTurns((t) => ({ ...t, [target]: [...t[target], { role: "assistant", content: "Sorry, that failed. Try again." }] }));
    } finally {
      setBusy(false);
    }
  }

  // Other parts of the dashboard ("Ask Jeremy about this ad") open the chat with a question ready to go.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<{ to?: Who; message?: string }>).detail ?? {};
      const target: Who = d.to === "berlin" || !jeremyOn ? "berlin" : "jeremy";
      setWho(target);
      setOpen(true);
      if (d.message) void ask(d.message, target);
    };
    window.addEventListener("berlin:ask", onAsk);
    return () => window.removeEventListener("berlin:ask", onAsk);
  });

  const list = turns[active];
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white shadow-xl hover:opacity-90">
          <MessageCircle size={16} /> {jeremyOn ? "Ask Jeremy" : "Ask Berlin"}
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-2xl">
          <div className="border-b border-[var(--panel-border)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex rounded-lg border border-[var(--panel-border)] p-0.5">
                {(["jeremy", "berlin"] as Who[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWho(w)}
                    disabled={w === "jeremy" && !jeremyOn}
                    className={`rounded-md px-3 py-1 text-[13px] font-semibold disabled:opacity-40 ${active === w ? "bg-black text-white" : "text-[var(--text-muted)]"}`}
                  >
                    {w === "jeremy" ? "Jeremy AI" : "Berlin"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {list.length ? (
                  <button onClick={() => { setTurns((t) => ({ ...t, [active]: [] })); if (active === "jeremy") setConv(null); }} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-strong)]">New chat</button>
                ) : null}
                <button onClick={() => setOpen(false)} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              {active === "jeremy" ? "Jeremy AI: your marketing brain. It reads Berlin's numbers itself." : jeremyOn ? "Berlin: fast answers from today's numbers and your SOPs." : "Jeremy AI isn't connected yet. Berlin answers from today's numbers and your SOPs."}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!list.length ? (
              <div className="space-y-2">
                <p className="text-[13px] text-[var(--text-muted)]">Try:</p>
                {STARTERS[active].map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-[var(--panel-border)] px-3 py-2 text-left text-[13px] hover:border-[var(--accent)]">{s}</button>
                ))}
              </div>
            ) : null}
            {list.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="ml-8 whitespace-pre-wrap rounded-2xl rounded-br-sm bg-black px-3 py-2 text-[14px] text-white">{t.content}</div>
              ) : (
                <div key={i} className="mr-4">
                  <Markdown source={t.content} />
                  {t.sources?.length ? <div className="mt-1 text-[11px] text-[var(--text-muted)]">Used: {t.sources.join(", ")}</div> : null}
                </div>
              ),
            )}
            {busy ? <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]"><Sparkles size={13} /> {active === "jeremy" ? "Jeremy AI is thinking… (can take a minute)" : "Reading the numbers… (about 30 seconds)"}</div> : null}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-[var(--panel-border)] p-3">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
              rows={1}
              placeholder={active === "jeremy" ? "Message Jeremy AI…" : "Ask about your numbers…"}
              className="flex-1 resize-none rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button type="submit" disabled={busy || !q.trim()} className="rounded-lg bg-black px-3 text-white disabled:opacity-40" aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
      ) : null}
    </>
  );
}
