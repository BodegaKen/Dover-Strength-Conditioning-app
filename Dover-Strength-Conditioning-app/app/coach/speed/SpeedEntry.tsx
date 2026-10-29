"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SpeedRow = { id: string; name: string; position: string | null; value: string; prev: string | null };

// One column of times for the chosen event and day. Type each athlete's best hand-timed attempt;
// leave a box empty to skip, or clear a box that already had a time to remove it.
export default function SpeedEntry({ event, date, rows }: { event: string; date: string; rows: SpeedRow[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.value])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const entries = rows
        .filter((r) => (vals[r.id] ?? "").trim() !== "" || r.value !== "")
        .map((r) => ({ athleteId: r.id, seconds: (vals[r.id] ?? "").trim() === "" ? null : Number(vals[r.id]) }));
      if (entries.length === 0) {
        setMsg({ ok: false, text: "No times entered yet." });
        return;
      }
      const res = await fetch("/api/coach/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, date, entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Couldn't save." });
        return;
      }
      setMsg({ ok: true, text: `Saved ${data.saved} time${data.saved === 1 ? "" : "s"}${data.cleared ? `, cleared ${data.cleared}` : ""}.` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-line">
        {rows.length === 0 && <p className="text-sm text-muted py-3">No active athletes yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-[140px]">
              <span className="font-semibold">{r.name}</span> {r.position && <span className="text-muted text-xs">{r.position}</span>}
            </div>
            {r.prev && <span className="text-xs text-muted whitespace-nowrap">last {r.prev}</span>}
            <input
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              aria-label={`${r.name} time in seconds`}
              value={vals[r.id] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [r.id]: e.target.value }))}
              placeholder="sec"
              className="w-24 rounded-md border border-line bg-bg px-2 py-1.5 num text-right"
            />
          </div>
        ))}
      </div>
      {msg && (
        <div className={`text-sm rounded-md border px-3 py-2 ${msg.ok ? "border-good bg-good-bg" : "border-danger bg-danger-bg"}`}>{msg.text}</div>
      )}
      <div>
        <button type="button" disabled={busy} onClick={save} className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-50">
          {busy ? "Saving…" : "Save times"}
        </button>
      </div>
    </div>
  );
}
