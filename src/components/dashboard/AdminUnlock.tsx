"use client";

import { useState } from "react";

/** Password prompt shown in place of the Admin Team tab until it's unlocked. */
export function AdminUnlock({ fallback }: { fallback: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
      return;
    }
    setBusy(false);
    setError("Wrong password.");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Admin Team</h1>
      <form
        onSubmit={submit}
        className="flex max-w-sm flex-col gap-3 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] p-6"
      >
        <label htmlFor="admin-password" className="text-sm font-medium text-[var(--text)]">
          This tab is password protected.
        </label>
        <input
          id="admin-password"
          type="password"
          inputMode="numeric"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:ring-1 focus:ring-sky-300/50"
          placeholder="Password"
        />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-md bg-sky-400/20 px-3 py-2 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/40 hover:bg-sky-400/30 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
