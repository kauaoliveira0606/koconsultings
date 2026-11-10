"use client";

import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";

type Role = "admin" | "sales";

const ROLES: { id: Role; label: string; hint: string; Icon: typeof Users }[] = [
  { id: "sales", label: "Sales Team", hint: "Sales tabs and Cash Calendar", Icon: Users },
  { id: "admin", label: "Admin Team", hint: "Everything, password required", Icon: ShieldCheck },
];

/** Dashboard login: pick who you are. Admin needs the password, Sales Team doesn't. */
export default function LoginPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, password }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(role === "admin" ? "Wrong password." : "Could not log in. Try again.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    // The proxy sends Sales Team to their home tab if `next` is admin only.
    window.location.href = safeNext ?? (role === "admin" ? "/bronson/overview" : "/bronson/sales-team");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4 py-10 text-neutral-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-sm font-black text-white">B</span>
          <div className="leading-tight">
            <div className="text-[16px] font-extrabold tracking-tight">BERLIN</div>
            <div className="text-[12px] text-neutral-500">Log in to the dashboard</div>
          </div>
        </div>

        <div className="mb-2 text-[13px] font-bold text-neutral-700">Who are you?</div>
        <div className="space-y-2">
          {ROLES.map(({ id, label, hint, Icon }) => {
            const active = role === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setRole(id);
                  setError("");
                }}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[15px] font-semibold">{label}</span>
                  <span className="block text-[12px] text-neutral-500">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {role === "admin" ? (
          <div className="mt-4">
            <label htmlFor="password" className="mb-1 block text-[13px] font-bold text-neutral-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[15px] outline-none focus:border-neutral-900"
            />
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || !role || (role === "admin" && !password)}
          className="mt-5 w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-[15px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
