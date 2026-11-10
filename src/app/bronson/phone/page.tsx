"use client";

import { useState } from "react";
import { BerlinHeader, Panel } from "@/components/berlin/Berlin";

const STEPS: Record<string, string[]> = {
  iPhone: [
    "Open www.koconsultings.com in Safari and sign in.",
    "Tap the Share button (the square with an arrow up) at the bottom.",
    "Scroll down and tap Add to Home Screen.",
    "Keep the name Berlin and tap Add.",
    "Open it from the new icon. It runs full screen and stays signed in.",
  ],
  Android: [
    "Open www.koconsultings.com in Chrome and sign in.",
    "Tap the three-dot menu at the top right.",
    "Tap Install app (or Add to Home screen).",
    "Confirm the name Berlin and tap Install.",
    "Open it from the new icon. It runs full screen.",
  ],
  "On a computer": [
    "Open www.koconsultings.com in Chrome or Edge.",
    "Click the install icon at the right end of the address bar.",
    "Click Install.",
    "Berlin opens in its own window, like an app.",
  ],
};

export default function PhonePage() {
  const [tab, setTab] = useState<keyof typeof STEPS>("iPhone");
  return (
    <div className="max-w-3xl">
      <BerlinHeader
        title="Phone app"
        subtitle="Berlin installs on your phone like an app: its own icon, full screen, same login. No App Store needed."
      />
      <div className="mb-4 inline-flex rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-1">
        {Object.keys(STEPS).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as keyof typeof STEPS)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-[var(--panel-bg)] text-[var(--text-strong)] shadow-sm" : "text-[var(--text-muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Panel>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text)]">
          {STEPS[tab].map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Panel>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        This is the installable web app (PWA). A native build for the App Store, using your Apple Developer account, is the next step.
      </p>
    </div>
  );
}
