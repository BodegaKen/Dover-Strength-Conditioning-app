"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RosterRow = {
  id: string;
  name: string;
  position: string | null;
  present: boolean | null; // coach roll call: true present, false absent, null not marked
  appState: "complete" | "partial" | "none"; // from the athlete's own logging that day
};

function stateOf(r: RosterRow): { label: string; tone: string } {
  if (r.present === false) return { label: "✗ Absent", tone: "border-danger bg-danger-bg text-danger" };
  if (r.present === true && r.appState === "complete") return { label: "✓ Present, completed", tone: "border-good bg-good-bg text-good" };
  if (r.present === true) return { label: r.appState === "partial" ? "Present, incomplete" : "Present, nothing logged", tone: "border-warning bg-warning-bg text-warning" };
  if (r.appState === "complete") return { label: "Completed in app (not marked)", tone: "border-line text-muted" };
  if (r.appState === "partial") return { label: "Partly logged (not marked)", tone: "border-line text-muted" };
  return { label: "Not marked", tone: "border-line text-muted" };
}

export default function AttendanceRoster({ date, rows }: { date: string; rows: RosterRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const present = rows.filter((r) => r.present === true).length;
  const absent = rows.filter((r) => r.present === false).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          {present} present &middot; {absent} absent &middot; {rows.length - present - absent} not marked
        </span>
        <span className="flex-1" />
        <button type="button" disabled={busy} onClick={() => send({ bulk: "present" })} className="text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border border-line disabled:opacity-50">
          Mark everyone present
        </button>
        <button type="button" disabled={busy} onClick={() => send({ bulk: "clear" })} className="text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border border-line disabled:opacity-50">
          Clear day
        </button>
      </div>
      {error && <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">{error}</div>}
      <div className="flex flex-col divide-y divide-line">
        {rows.length === 0 && <p className="text-sm text-muted py-3">No active athletes yet.</p>}
        {rows.map((r) => {
          const st = stateOf(r);
          return (
            <div key={r.id} className="py-2 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[150px]">
                <span className="font-semibold">{r.name}</span>{" "}
                {r.position && <span className="text-muted text-xs">{r.position}</span>}
              </div>
              <span className={`text-xs rounded-full px-2.5 py-1 border ${st.tone}`}>{st.label}</span>
              <div className="flex gap-1">
                <button type="button" disabled={busy} onClick={() => send({ athleteId: r.id, present: r.present === true ? null : true })}
                  className={`text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border ${r.present === true ? "border-good bg-good-bg text-good font-semibold" : "border-line"}`}>
                  Present
                </button>
                <button type="button" disabled={busy} onClick={() => send({ athleteId: r.id, present: r.present === false ? null : false })}
                  className={`text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border ${r.present === false ? "border-danger bg-danger-bg text-danger font-semibold" : "border-line"}`}>
                  Absent
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
