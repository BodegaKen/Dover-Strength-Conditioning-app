"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/calc";

export type Section = "warmup" | "main" | "accessory" | "finisher";

export type ExerciseView = {
  lift: string; // storage key
  label: string;
  section: Section;
  sets: number;
  reps: string;
  unit?: string;
  pctLabel: string; // e.g. "75% e1RM" or ""
  target: string | null; // e.g. "225" or "205-215"
  targetFirst: number | null;
  entry: "weight" | "reps" | "time" | "check" | "info";
  allowBodyweight?: boolean;
  backoff: { sets: number; reps: string; pctLabel: string; target: string | null } | null;
  ramp?: string; // "50% x5 -> 112.5 lb · 65% x3 -> 145 lb · 75% x2 -> 167.5 lb"
  note?: string;
  hint?: string;
  details?: string[];
};

export type LoggedSetView = { lift: string; setNumber: number; weight: number | null; reps: number | null };

const BACKOFF_BASE = 100;

const SECTION_TITLE: Record<Section, string> = {
  warmup: "Warm-up (NMT) - do before lifting",
  main: "Main work",
  accessory: "Accessory circuit",
  finisher: "Finisher",
};
const SECTION_ORDER: Section[] = ["warmup", "main", "accessory", "finisher"];

export default function SetLogger({
  planDay,
  exercises,
  initial,
  initialDate,
  sectionNotes,
  athleteId,
  askRpe,
  ratings,
}: {
  planDay: string;
  exercises: ExerciseView[];
  initial: LoggedSetView[];
  initialDate?: string;
  sectionNotes?: Partial<Record<Section, string>>;
  athleteId?: string; // coach editing on a player's behalf
  askRpe?: boolean; // Phase 4 / Camp Bridge only: ask for the session rating once the day is complete
  ratings?: Record<string, { rpe: number; durationMin: number }>; // existing lift-session ratings by date
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
  const [rated, setRated] = useState<Record<string, { rpe: number; durationMin: number }>>(ratings ?? {});
  const [duration, setDuration] = useState("35");
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const [rateSkipped, setRateSkipped] = useState(false);

  function setField(lift: string, n: number, field: "weight" | "reps", v: string) {
    setVals((p) => ({
      ...p,
      [k(lift, n)]: { weight: p[k(lift, n)]?.weight ?? "", reps: p[k(lift, n)]?.reps ?? "", [field]: v },
    }));
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
    if (ex.entry === "weight") return ex.allowBodyweight ? !!v?.weight || !!v?.reps : !!v?.weight;
    return !!v?.reps;
  };
  const total = exercises.reduce((a, e) => a + e.sets, 0);
  const done = exercises.reduce(
    (a, e) => a + Array.from({ length: e.sets }, (_, i) => i + 1).filter((n) => isDone(e, n)).length,
    0
  );
  const complete = total > 0 && done >= total;

  async function rate(rpe: number) {
    const d = parseFloat(duration);
    if (!(d > 0)) {
      setRateMsg("Enter how many minutes the session took, then tap a number.");
      return;
    }
    setRateMsg(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lift", date, rpe, durationMin: d, replace: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateMsg(data.error ?? "Couldn't save the rating.");
        return;
      }
      setRated((p) => ({ ...p, [date]: { rpe, durationMin: d } }));
      router.refresh();
    } catch {
      setRateMsg("Couldn't save the rating. Check your connection and try again.");
    }
  }

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
        body: JSON.stringify({ planDay, date, entries, athleteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Couldn't save.", err: true });
        return;
      }
      setMsg({
        text: data.progress?.complete
          ? "Saved. Day complete ✓"
          : `Saved. ${data.progress?.done ?? done} of ${data.progress?.total ?? total} items logged.`,
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full min-w-0 bg-bg border border-line rounded-md px-2.5 py-2 num";
  const repsW = "max-w-[5rem]";

  function renderRow(ex: ExerciseView, n: number) {
    const label = ex.sets > 1 ? `${ex.section === "accessory" ? "Round" : "Set"} ${n}` : "";
    const v = vals[k(ex.lift, n)];
    return (
      <div key={n} className="flex items-center gap-2">
        {label && <div className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted">{label}</div>}
        {ex.entry === "weight" && (
          <>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-label={`${ex.label} ${label} weight`}
              placeholder={ex.targetFirst != null ? String(ex.targetFirst) : "lb"}
              className={`${inputCls} max-w-[7rem]`}
              value={v?.weight ?? ""}
              onChange={(e) => setField(ex.lift, n, "weight", e.target.value)}
            />
            <span className="text-xs text-muted shrink-0">lb &times;</span>
          </>
        )}
        {(ex.entry === "weight" || ex.entry === "reps") && (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            aria-label={`${ex.label} ${label} reps`}
            placeholder={ex.reps ? ex.reps : "reps"}
            className={`${inputCls} ${repsW}`}
            value={v?.reps ?? ""}
            onChange={(e) => setField(ex.lift, n, "reps", e.target.value)}
          />
        )}
        {ex.entry === "time" && (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            aria-label={`${ex.label} ${label} seconds`}
            placeholder={ex.reps ? ex.reps : "sec"}
            className={`${inputCls} ${repsW}`}
            value={v?.reps ?? ""}
            onChange={(e) => setField(ex.lift, n, "reps", e.target.value)}
          />
        )}
        {ex.entry === "reps" && <span className="text-xs text-muted shrink-0">reps{ex.unit ? ` ${ex.unit}` : ""}</span>}
        {ex.entry === "weight" && ex.unit && <span className="text-xs text-muted shrink-0">{ex.unit}</span>}
        {ex.entry === "time" && <span className="text-xs text-muted shrink-0">sec</span>}
        <span className={`w-5 text-center shrink-0 ${isDone(ex, n) ? "text-good" : "text-line"}`}>{isDone(ex, n) ? "✓" : "○"}</span>
      </div>
    );
  }

  function renderCheck(ex: ExerciseView) {
    const on = !!vals[k(ex.lift, 1)]?.reps;
    return (
      <div key={ex.lift} className="border border-line rounded-lg p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-[var(--accent)]"
            checked={on}
            onChange={(e) => setField(ex.lift, 1, "reps", e.target.checked ? "1" : "")}
          />
          <span className="flex-1">
            <span className="font-bold">{ex.label}</span>
            {ex.note && <span className="block text-xs text-muted mt-0.5">{ex.note}</span>}
          </span>
        </label>
        {ex.details && ex.details.length > 0 && (
          <details className="mt-2 ml-8">
            <summary className="text-xs uppercase tracking-wide text-accent font-semibold cursor-pointer">What&rsquo;s in it</summary>
            <ul className="list-disc ml-5 mt-1 text-sm text-muted flex flex-col gap-0.5">
              {ex.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  function renderInfo(ex: ExerciseView) {
    return (
      <div key={ex.lift} className="border border-line rounded-lg p-3">
        <div className="font-bold">{ex.label}</div>
        {ex.note && <div className="text-xs text-muted mt-0.5">{ex.note}</div>}
        {ex.details && ex.details.length > 0 && (
          <ul className="list-disc ml-5 mt-1.5 text-sm text-muted flex flex-col gap-0.5">
            {ex.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function renderCard(ex: ExerciseView) {
    if (ex.entry === "info") return renderInfo(ex);
    if (ex.entry === "check") return renderCheck(ex);
    return (
      <div key={ex.lift} className="border border-line rounded-lg p-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="font-bold">{ex.label}</div>
          <div className="text-sm text-muted">
            {ex.sets} x {ex.reps}
            {ex.entry === "time" ? " sec" : ""}
            {ex.unit && ex.entry !== "time" ? ` ${ex.unit}` : ""}
            {ex.pctLabel ? ` @ ${ex.pctLabel}` : ""}
          </div>
        </div>
        {ex.target && <div className="num text-lg font-semibold mt-0.5">Target {ex.target} lb</div>}
        {ex.hint && <div className="text-sm text-warning mt-0.5">{ex.hint}</div>}
        {ex.ramp && <div className="text-xs text-muted mt-0.5">Ramp: {ex.ramp}</div>}
        {ex.note && <div className="text-xs text-muted mt-0.5">{ex.note}</div>}

        <div className="mt-2 flex flex-col gap-1.5">
          {Array.from({ length: ex.sets }, (_, i) => i + 1).map((n) => renderRow(ex, n))}
          {ex.entry === "weight" && ex.sets > 1 && (
            <button
              type="button"
              onClick={() => applyFirstToAll(ex)}
              className="self-start text-xs uppercase tracking-wide text-accent font-semibold"
            >
              Same weight for all {ex.section === "accessory" ? "rounds" : "sets"}
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
                <div className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted">Back-off</div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="lb"
                  aria-label={`${ex.label} back-off weight`}
                  className={`${inputCls} max-w-[7rem]`}
                  value={vals[k(ex.lift, n)]?.weight ?? ""}
                  onChange={(e) => setField(ex.lift, n, "weight", e.target.value)}
                />
                <span className="text-xs text-muted shrink-0">lb &times;</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="any"
                  placeholder="reps"
                  aria-label={`${ex.label} back-off reps`}
                  className={`${inputCls} ${repsW}`}
                  value={vals[k(ex.lift, n)]?.reps ?? ""}
                  onChange={(e) => setField(ex.lift, n, "reps", e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const sections = SECTION_ORDER.map((s) => ({ s, items: exercises.filter((e) => e.section === s) })).filter(
    (g) => g.items.length > 0
  );
  const showTitles = sections.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ s, items }) => (
        <div key={s} className="flex flex-col gap-3">
          {showTitles && (
            <div>
              <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold">{SECTION_TITLE[s]}</div>
              {sectionNotes?.[s] && <p className="text-xs text-muted mt-0.5">{sectionNotes[s]}</p>}
            </div>
          )}
          {items.map((ex) => renderCard(ex))}
        </div>
      ))}

      {total > 0 && (
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
          {complete ? "Everything logged ✓" : `${done} of ${total} items`}
        </div>
      </div>
      )}
      {msg && (
        <div className={`text-sm rounded-md border px-3 py-2 ${msg.err ? "border-danger bg-danger-bg" : "border-good bg-good-bg"}`}>
          {msg.text}
        </div>
      )}
      {askRpe && !athleteId && complete && (
        <div className="rounded-lg border border-line bg-bg p-3 flex flex-col gap-2">
          {rated[date] ? (
            <div className="text-sm">
              <span className="text-good font-semibold">Session rated ✓</span>{" "}
              <span className="text-muted">
                RPE {rated[date].rpe} &middot; {rated[date].durationMin} min. Tap a different number to change it.
              </span>
            </div>
          ) : (
            !rateSkipped && (
              <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold">
                How hard was today&rsquo;s whole session?
              </div>
            )
          )}
          {(!rateSkipped || rated[date]) && (
            <>
              <p className="text-xs text-muted">
                0 = rest, 3 = moderate, 5 = hard, 7 = very hard, 10 = max. Rate the whole session, from the start of the warm-up to the
                end of the finisher, not a single set.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => rate(n)}
                    aria-label={`Rate session ${n} out of 10`}
                    className={`num w-10 h-10 rounded-md border text-base font-semibold ${
                      rated[date]?.rpe === n ? "bg-accent text-accent-ink border-accent" : "border-line bg-surface"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted">Minutes</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={240}
                  className="bg-bg border border-line rounded-md px-3 py-1.5 w-20"
                  value={rated[date] ? String(rated[date].durationMin) : duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                {!rated[date] && (
                  <button type="button" onClick={() => setRateSkipped(true)} className="text-xs text-muted underline ml-auto">
                    Skip for now
                  </button>
                )}
              </div>
              {rateMsg && <div className="text-sm text-danger">{rateMsg}</div>}
            </>
          )}
          {!rated[date] && rateSkipped && (
            <button type="button" onClick={() => setRateSkipped(false)} className="text-xs text-accent underline self-start">
              Rate today&rsquo;s session
            </button>
          )}
        </div>
      )}
    </div>
  );
}
