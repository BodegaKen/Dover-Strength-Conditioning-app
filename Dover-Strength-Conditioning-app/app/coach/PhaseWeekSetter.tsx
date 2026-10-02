"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Track = { key: string; name: string; periods: { index: number; label: string }[] };

export default function PhaseWeekSetter({
  tracks,
  current,
}: {
  tracks: Track[];
  current: { trackKey: string; week: number };
}) {
  const router = useRouter();
  const [trackKey, setTrackKey] = useState(current.trackKey);
  const [week, setWeek] = useState(current.week);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const track = tracks.find((t) => t.key === trackKey) ?? tracks[0];

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/program-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackKey, week }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h2 className="text-lg mb-1">Where is the team right now?</h2>
      <p className="text-sm text-muted mb-3">
        This sets what every player sees on their This Week tab.
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Phase / block</label>
          <select
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={trackKey}
            onChange={(e) => {
              setTrackKey(e.target.value);
              setWeek(1);
              setSaved(false);
            }}
          >
            {tracks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Week</label>
          <select
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={week}
            onChange={(e) => {
              setWeek(Number(e.target.value));
              setSaved(false);
            }}
          >
            {track.periods.map((p) => (
              <option key={p.index} value={p.index}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Set current week"}
        </button>
        {saved && <span className="text-good text-sm">Saved.</span>}
      </div>
    </div>
  );
}
