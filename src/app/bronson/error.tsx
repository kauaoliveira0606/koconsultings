"use client";

import { useEffect } from "react";
import { clearSavedSections } from "@/lib/range-context";

/**
 * Shown instead of Next's blank "This page couldn't load" when a Bronson tab
 * throws. Clears the numbers saved in this browser (the usual cause: a copy
 * saved by an older build) and lets the person try again in place.
 */
export default function BronsonError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    clearSavedSections();
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-center">
      <div className="text-lg font-bold text-[var(--text-strong)]">This tab hit a snag</div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Saved numbers in this browser were cleared. Try again and it will load fresh.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={() => reset()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">Try again</button>
        <button onClick={() => window.location.reload()} className="rounded-lg border border-[var(--panel-border)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)]">Reload page</button>
      </div>
    </div>
  );
}
