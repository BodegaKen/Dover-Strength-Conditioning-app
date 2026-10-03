"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIFTS, RPE_DESC, calcE1RM, todayISO, LiftKey } from "@/lib/calc";

export default function LogForms({ currentE1RMs }: { currentE1RMs: Record<string, number | null> }) {
  const [mode, setMode] = useState<"test" | "session" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <ModeButton active={mode === "test"} onClick={() => setMode("test")}>
          <strong className="block font-display uppercase text-sm">Log a test max</strong>
          <span className="text-muted text-xs">5RM on a major lift &rarr; auto e1RM</span>
        </ModeButton>
        <ModeButton active={mode === "session"} onClick={() => setMode("session")}>
          <strong className="block font-display uppercase text-sm">Log a session</strong>
          <span className="text-muted text-xs">RPE + duration &rarr; auto load</span>
        </ModeButton>
      </div>
      {mode === "test" && <TestForm currentE1RMs={currentE1RMs} />}
      {mode === "session" && <SessionForm />}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-4 bg-surface ${
        active ? "border-accent shadow-[inset_0_0_0_1px_var(--accent)]" : "border-line"
      }`}
    >
      {children}
    </button>
  );
}

function Feedback({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div
      className={`text-sm rounded-md border px-3 py-2 ${
        isError ? "border-danger bg-danger-bg" : "border-good bg-good-bg"
      }`}
    >
      {message}
    </div>
  );
}

function TestForm({ currentE1RMs }: { currentE1RMs: Record<string, number | null> }) {
  const router = useRouter();
  const [lift, setLift] = useState<LiftKey>(LIFTS[0].key);
  const [fiveRM, setFiveRM] = useState("");
  const [date, setDate] = useState(todayISO());
  const [feedback, setFeedback] = useState<{ msg: string; err?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = parseFloat(fiveRM);
  const preview = parsed > 0 ? calcE1RM(parsed) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(parsed > 0)) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lift, fiveRM: parsed, date }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ msg: data.error ?? "Couldn't save that test.", err: true });
        return;
      }
      setFeedback({ msg: `${LIFTS.find((l) => l.key === lift)?.label} 5RM ${parsed} lb → e1RM ${data.test.e1RM} lb logged.` });
      setFiveRM("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Lift</label>
          <select
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={lift}
            onChange={(e) => setLift(e.target.value as LiftKey)}
          >
            {LIFTS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            {lift === "pullup" ? "Added weight for 5RM (lb)" : "Tested 5RM (lb)"}
          </label>
          <input
            type="number"
            min={1}
            max={800}
            step="any"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={fiveRM}
            onChange={(e) => setFiveRM(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Date</label>
          <input
            type="date"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      {preview != null && <div className="text-sm text-muted">e1RM: {preview} lb</div>}
      {feedback && <Feedback message={feedback.msg} isError={feedback.err} />}
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-50"
      >
        Save test
      </button>
    </form>
  );
}

function SessionForm() {
  const router = useRouter();
  const [type, setType] = useState("lift");
  const [date, setDate] = useState(todayISO());
  const [durationMin, setDurationMin] = useState("30");
  const [rpe, setRpe] = useState(6);
  const [feedback, setFeedback] = useState<{ msg: string; err?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = rpe * (parseFloat(durationMin) || 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseFloat(durationMin);
    if (!(d > 0)) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, date, rpe, durationMin: d }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ msg: data.error ?? "Couldn't save that session.", err: true });
        return;
      }
      setFeedback({ msg: `${type} session logged: RPE ${rpe} × ${d} min = ${rpe * d} load.` });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Type</label>
          <select
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="lift">Lift</option>
            <option value="practice">Practice</option>
            <option value="game">Game</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Date</label>
          <input
            type="date"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            Duration (min)
          </label>
          <input
            type="number"
            min={1}
            max={240}
            step="any"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
          Session RPE (0-10, Borg CR-10)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="num text-2xl w-10 text-center">{rpe}</span>
        </div>
        <div className="text-sm text-muted">{RPE_DESC[rpe]}</div>
      </div>
      <div className="text-sm text-muted">Session load: {load} units (RPE &times; minutes)</div>
      {feedback && <Feedback message={feedback.msg} isError={feedback.err} />}
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5 disabled:opacity-50"
      >
        Save session
      </button>
    </form>
  );
}
