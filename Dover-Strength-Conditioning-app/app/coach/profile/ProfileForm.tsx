"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({ initialName, username }: { initialName: string; username: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    setLoading(true);
    try {
      const res = await fetch("/api/coach/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save the name.");
        return;
      }
      setName(data.name);
      setSaved(data.name);
      setOk(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted">Display name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setOk(false);
          }}
          maxLength={80}
          autoComplete="name"
          className="bg-bg border border-line rounded-md px-3 py-2"
        />
      </label>
      <div className="text-sm text-muted">
        Sign-in username: <span className="num text-fg">{username}</span> (this stays the same)
      </div>
      {error && <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">{error}</div>}
      {ok && <div className="text-sm rounded-md border border-line px-3 py-2">Saved. You&rsquo;re now shown as {saved}.</div>}
      <button
        type="submit"
        disabled={loading || name.trim() === saved}
        className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md py-2.5 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save name"}
      </button>
    </form>
  );
}
