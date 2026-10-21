"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CoachRow = { id: string; name: string; username: string; isAdmin: boolean; active: boolean; mustChangePin: boolean };

// Full admins only (the page doesn't render this for limited coaches, and the API refuses them
// anyway). New coaches get a temporary 6-digit PIN shown once and must change it at first sign-in.
export default function CoachesAdmin({ coaches, meId }: { coaches: CoachRow[]; meId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim()) return;
    const res = await fetch("/api/coach/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isAdmin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't add that coach.");
      return;
    }
    setNotice(
      `Added ${data.coach.name} (${data.coach.isAdmin ? "full admin" : "limited coach"}). Username "${data.coach.username}", temporary PIN ${data.pin}. Give it to them now; it only shows once, and they must choose their own PIN at first sign-in.`
    );
    setName("");
    setIsAdmin(false);
    router.refresh();
  }

  async function act(id: string, body: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/coach/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return;
    }
    if (body.action === "resetPin") setNotice(`New temporary PIN: ${data.pin}. They'll be asked to choose their own at next sign-in.`);
    router.refresh();
  }

  return (
    <details className="bg-surface border border-line rounded-xl">
      <summary className="p-4 cursor-pointer font-display uppercase tracking-wide text-sm">Coach accounts (full admins only)</summary>
      <div className="px-4 pb-4 flex flex-col gap-3">
        <p className="text-sm text-muted">
          <strong>Full admin:</strong> everything on the coach pages, plus deleting athletes, resetting PINs, adding coaches and
          the audit log. <strong>Limited coach:</strong> everything else (roster edits, logging, tests, attendance, coaching
          documents), but no deleting athletes and no PIN resets.
        </p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">New coach name</label>
            <input
              className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bill Goble"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2.5">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Full admin
          </label>
          <button type="submit" className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5">
            Add coach
          </button>
        </form>
        {notice && <div className="text-sm rounded-md border border-good bg-good-bg px-3 py-2">{notice}</div>}
        {error && <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">{error}</div>}
        <div className="flex flex-col divide-y divide-line">
          {coaches.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{c.name}</span>{" "}
                <span className="text-muted text-sm">
                  {c.username} &middot; {c.isAdmin ? "full admin" : "limited"}
                  {!c.active ? " · inactive" : ""}
                  {c.mustChangePin ? " · has not set own PIN yet" : ""}
                  {c.id === meId ? " · you" : ""}
                </span>
              </div>
              {c.id !== meId && (
                <div className="flex gap-1.5">
                  <Btn onClick={() => act(c.id, { action: "resetPin" })}>Reset PIN</Btn>
                  <Btn onClick={() => act(c.id, { action: "setAdmin", isAdmin: !c.isAdmin })}>
                    {c.isAdmin ? "Make limited" : "Make full admin"}
                  </Btn>
                  <Btn onClick={() => act(c.id, { action: c.active ? "archive" : "restore" })}>
                    {c.active ? "Deactivate" : "Restore"}
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border border-line">
      {children}
    </button>
  );
}
