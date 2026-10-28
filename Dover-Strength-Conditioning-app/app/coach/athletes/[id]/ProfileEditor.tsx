"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { positionGroup } from "@/lib/position";

type Props = {
  athleteId: string;
  name: string;
  position: string | null;
  gradYear: number | null;
  bodyweight: number | null;
  defaultOpen?: boolean;
};

const QUICK_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K/P"];

function readsAs(position: string): string {
  switch (positionGroup(position)) {
    case "LINE":
      return "Lineman lane";
    case "SKILL":
      return "Skill lane";
    case "MIXED":
      return "Two-way (one lineman side, one skill side): alternates skill lane on odd weeks, lineman lane on even weeks";
    default:
      return position.trim() ? "Not recognised: gets the standard circuit" : "Blank: gets the standard circuit";
  }
}

export default function ProfileEditor({ athleteId, name: n0, position: p0, gradYear: g0, bodyweight: w0, defaultOpen }: Props) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [position, setPosition] = useState(p0 ?? "");
  const [gradYear, setGradYear] = useState(g0 != null ? String(g0) : "");
  const [bodyweight, setBodyweight] = useState(w0 != null ? String(w0) : "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    // Send only what changed, so a stale form can't overwrite a field someone else just edited.
    const patch: Record<string, unknown> = { action: "update" };
    if (name.trim() !== n0) patch.name = name.trim();
    if (position.trim() !== (p0 ?? "")) patch.position = position.trim();
    if (gradYear.trim() !== (g0 != null ? String(g0) : "")) patch.gradYear = gradYear.trim();
    if (bodyweight.trim() !== (w0 != null ? String(w0) : "")) patch.bodyweight = bodyweight.trim();
    if (Object.keys(patch).length === 1) {
      setMsg({ ok: true, text: "No changes to save." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Could not save." });
      } else {
        setMsg({ ok: true, text: "Saved." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full bg-bg border border-line rounded-md px-3 py-2.5";
  const label = "block text-xs font-semibold uppercase tracking-wide text-muted mb-1";

  return (
    <details id="profile" className="bg-surface border border-line rounded-xl" open={defaultOpen}>
      <summary className="p-4 cursor-pointer font-display uppercase tracking-wide text-sm">
        Edit profile: name, position, grad year, weight
      </summary>
      <form onSubmit={save} className="px-4 pb-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </div>
          <div>
            <label className={label}>Position</label>
            <input
              className={input}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. RB or OL/DL"
              maxLength={30}
            />
          </div>
          <div>
            <label className={label}>Grad year</label>
            <input
              type="number"
              inputMode="numeric"
              className={input}
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              placeholder="e.g. 2028"
              min={2020}
              max={2040}
            />
          </div>
          <div>
            <label className={label}>Weight (lb)</label>
            <input
              type="number"
              inputMode="decimal"
              className={input}
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              placeholder="e.g. 215"
              min={50}
              max={600}
              step="0.5"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted">Quick position:</span>
          {QUICK_POSITIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setPosition(q)}
              className="text-xs rounded-md px-2 py-1 border border-line"
            >
              {q}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Position reads as: <span className="text-fg font-semibold">{readsAs(position)}</span>. For a two-way player type both,
          like &ldquo;OL/DL&rdquo; or &ldquo;RB/LB&rdquo;.
        </p>
        <p className="text-xs text-muted">
          A position change takes effect on this athlete&rsquo;s next session; past logs and tests are not changed. A weight change
          updates the weighted pull-up belt load going forward (past tests keep the bodyweight they were taken at).
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-good" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </form>
    </details>
  );
}
