"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/calc";

export type ExerciseView = {
  lift: string;
  label: string;
  sets: number;
  reps: string;
  pctLabel: string; // e.g. "75% e1RM" or ""
  target: string | null; // e.g. "225" or "205-215"
  targetFirst: number | null;
  entry: "weight" | "reps";
  backoff: { sets: number; reps: string; pctLabel: string; target: string | null } | null;
  note?: string;
  hint?: string;
};

export type LoggedSetView = { lift: string; setNumber: number; weight: number | null; reps: number | null };

const BACKOFF_BASE = 100;

export default function SetLogger({
  planDay,
  exercises,
  initial,
  initialDate,
}: {
  planDay: string;
  exercises: ExerciseView[];
  initial: LoggedSetView[];
  initialDate?: string;
}) {
  const router = useRouter();
  const k = (lift: string, n: number) => `${lift}:${n}`;

  const [vals, setVals] = useState<Record<string, { weight: string; reps: string }>>(() => {
    const o: Record<string, { weight: string; reps: string }> = {};
    for (const s of initial) {
      o[k(s.lift, s.setNumber)] = {
        weight: s.weight != null ? String(s.weight) : "",
        reps: s.reps != null ? String(s.reps) : "",
      };
    }
    return o;
  });
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  function set(lift: string, n: number, field: "weight" | "reps", v: string) {
    setVals((p) => ({ ...p, [k(lift, n)]: { weight: p[k(lift, n)]?.weight ?? "", reps: p[k(lift, n)]?.reps ?? "", [field]: v } }));
    setMsg(null);
  }

  function applyFirstToAll(ex: ExerciseView) {
    const first = vals[k(ex.lift, 1)]?.weight ?? "";
    if (!first) return;
    setVals((p) => {
      const next = { ...p };
      for (let n = 2; n <= ex.sets; n++) next[k(ex.lift, n)] = { weight: first, reps: p[k(ex.lift, n)]?.reps ?? "" };
      return next;
    });
  }

  const isDone = (ex: ExerciseView, n: number) => {
    const v = vals[k(ex.lift, n)];
    return ex.entry === "reps" ? !!v?.reps : !!v?.weight;
  };
  const total = exercises.reduce((a, e) => a + e.sets, 0);
  const done = exercises.reduce((a, e) => a + Array.from({ length: e.sets }, (_, i) => i + 1).filter((n) => isDone(e, n)).length, 0);
  const complete = total > 0 && done >= total;

  async function save() {
    setSaving(true);
    setMsg(null);
    const entries: { lift: string; setNumber: number; weight: string; reps: string }[] = [];
    for (const ex of exercises) {
      const nums = Array.from({ length: ex.sets }, (_, i) => i + 1);
      if (ex.backoff) for (let i = 1; i <= ex.backoff.sets; i++) nums.push(BACKOFF_BASE + i);
      for (const n of nums) {
        const v = vals[k(ex.lift, n)];
        entries.push({ lift: ex.lift, setNumber: n, weight: v?.weight ?? "", reps: v?.reps ?? "" });
      }
    }
    try {
      const res = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDay, date, entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Couldn't save.", err: true });
        return;
      }
      setMsg({
        text: data.progress?.complete ? "Saved. Day complete ✓" : `Saved. ${data.progress?.done ?? done} of ${total} sets logged.`,
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-bg border border-line rounded-md px-2.5 py-2 num";

  return (
    <div className="flex flex-col gap-3">
      {exercises.map((ex) => (
        <div key={ex.lift} className="border border-line rounded-lg p-3">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="font-bold">{ex.label}</div>
            <div className="text-sm text-muted">
              {ex.sets} x {ex.reps}
              {ex.pctLabel ? ` @ ${ex.pctLabel}` : ""}
            </div>
          </div>
          {ex.target && (
            <div className="num text-lg font-semibold mt-0.5">
              Target {ex.target} lb
            </div>
          )}
          {ex.hint && <div className="text-sm text-warning mt-0.5">{ex.hint}</div>}
          {ex.note && <div className="text-xs text-muted mt-0.5">{ex.note}</div>}

          <div className="mt-2 flex flex-col gap-1.5">
            {Array.from({ length: ex.sets }, (_, i) => i + 1).map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div className="w-12 text-xs uppercase tracking-wide text-muted">Set {n}</div>
                {ex.entry === "weight" && (
                  <>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder={ex.targetFirst != null ? String(ex.targetFirst) : "lb"}
                      className={inputCls}
                      value={vals[k(ex.lift, n)]?.weight ?? ""}
                      onChange={(e) => set(ex.lift, n, "weight", e.target.value)}
                    />
                    <span className="text-xs text-muted">lb &times;</span>
                  </>
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="any"
                  placeholder={/^\d+$/.test(ex.reps) ? ex.reps : "reps"}
                  className={`${inputCls} ${ex.entry === "weight" ? "max-w-[5rem]" : ""}`}
                  value={vals[k(ex.lift, n)]?.reps ?? ""}
                  onChange={(e) => set(ex.lift, n, "reps", e.target.value)}
                />
                {ex.entry === "reps" && <span className="text-xs text-muted">reps</span>}
                <span className={`w-5 text-center ${isDone(ex, n) ? "text-good" : "text-line"}`}>{isDone(ex, n) ? "✓" : "○"}</span>
              </div>
            ))}
            {ex.entry === "weight" && ex.sets > 1 && (
              <button
                type="button"
                onClick={() => applyFirstToAll(ex)}
                className="self-start text-xs uppercase tracking-wide text-accent font-semibold"
              >
                Same weight for all sets
              </button>
            )}
          </div>

          {ex.backoff && (
            <div className="mt-3 pt-2 border-t border-line">
              <div className="text-xs uppercase tracking-wide text-muted mb-1">
                Back-off (optional): {ex.backoff.sets} x {ex.backoff.reps}
                {ex.backoff.pctLabel ? ` @ ${ex.backoff.pctLabel}` : ""}
                {ex.backoff.target ? ` · ${ex.backoff.target} lb` : ""}
              </div>
              {Array.from({ length: ex.backoff.sets }, (_, i) => BACKOFF_BASE + i + 1).map((n) => (
                <div key={n} className="flex items-center gap-2 mt-1">
                  <div className="w-12 text-xs uppercase tracking-wide text-muted">Back-off</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="lb"
                    className={inputCls}
                    value={vals[k(ex.lift, n)]?.weight ?? ""}
                    onChange={(e) => set(ex.lift, n, "weight", e.target.value)}
                  />
                  <span className="text-xs text-muted">lb &times;</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="any"
                    placeholder="reps"
                    className={`${inputCls} max-w-[5rem]`}
                    value={vals[k(ex.lift, n)]?.reps ?? ""}
                    onChange={(e) => set(ex.lift, n, "reps", e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Date done</label>
          <input
            type="date"
            className="bg-bg border border-line rounded-md px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="self-end bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <div className={`self-end text-sm ${complete ? "text-good font-semibold" : "text-muted"}`}>
          {complete ? "All sets logged ✓" : `${done} of ${total} sets`}
        </div>
      </div>
      {msg && (
        <div className={`text-sm rounded-md border px-3 py-2 ${msg.err ? "border-danger bg-danger-bg" : "border-good bg-good-bg"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
