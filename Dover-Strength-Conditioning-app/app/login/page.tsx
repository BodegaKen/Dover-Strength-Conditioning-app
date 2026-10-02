"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't sign in.");
        return;
      }
      const next = params.get("next");
      if (data.mustChangePin) {
        router.push("/change-pin");
      } else {
        router.push(next || (data.role === "COACH" ? "/coach" : "/dashboard"));
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-[0.72rem] tracking-[0.14em] text-accent font-display font-semibold">
            Dover Tigers Football
          </div>
          <h1 className="text-2xl mt-1">Strength &amp; Conditioning</h1>
        </div>
        <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1" htmlFor="pin">
              PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md py-2.5 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted mt-4">
          Don&rsquo;t have a username and PIN yet? Ask a coach &mdash; they set up every account.
        </p>
      </div>
    </div>
  );
}
