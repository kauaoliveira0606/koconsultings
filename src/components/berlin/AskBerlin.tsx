"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send } from "lucide-react";
import { Markdown } from "@/components/berlin/Markdown";

type Turn = { role: "user" | "assistant"; content: string; sources?: string[] };

const STARTERS = [
  "What should I fix first today?",
  "Which ad should I scale and which should I kill?",
  "Why is cost per registration up?",
  "How are we pacing today versus yesterday?",
];

/** "Ask Berlin": a chat drawer that answers from the live numbers and the knowledge base. */
export function AskBerlin() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: text }]);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch("/api/bronson/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, history, page: pathname }) });
      const j = await r.json();
      setTurns((t) => [...t, { role: "assistant", content: r.ok ? j.answer : `Sorry, that failed: ${j.error ?? r.status}`, sources: j.sources }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Sorry, that failed. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white shadow-xl hover:opacity-90"
        >
          <Sparkles size={16} /> Ask Berlin
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--text-strong)]"><Sparkles size={15} /> Ask Berlin</div>
              <div className="text-[11px] text-[var(--text-muted)]">Answers from today&rsquo;s live numbers and your SOPs</div>
            </div>
            <div className="flex gap-2">
              {turns.length ? <button onClick={() => setTurns([])} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-strong)]">New chat</button> : null}
              <button onClick={() => setOpen(false)} className="rounded-md border border-[var(--panel-border)] p-1.5" aria-label="Close"><X size={15} /></button>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!turns.length ? (
              <div className="space-y-2">
                <p className="text-[13px] text-[var(--text-muted)]">Ask anything about the ads, funnel or pace. Try:</p>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-[var(--panel-border)] px-3 py-2 text-left text-[13px] hover:border-[var(--accent)]">{s}</button>
                ))}
              </div>
            ) : null}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="ml-8 rounded-2xl rounded-br-sm bg-black px-3 py-2 text-[14px] text-white">{t.content}</div>
              ) : (
                <div key={i} className="mr-4">
                  <Markdown source={t.content} />
                  {t.sources?.length ? <div className="mt-1 text-[11px] text-[var(--text-muted)]">SOPs used: {t.sources.join(", ")}</div> : null}
                </div>
              ),
            )}
            {busy ? <div className="text-[13px] text-[var(--text-muted)]">Reading the numbers… (about 20-40 seconds)</div> : null}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-[var(--panel-border)] p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your numbers…" className="flex-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <button type="submit" disabled={busy || !q.trim()} className="rounded-lg bg-black px-3 text-white disabled:opacity-40" aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
      ) : null}
    </>
  );
}
