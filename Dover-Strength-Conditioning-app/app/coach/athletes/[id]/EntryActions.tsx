"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TestInit = { kind: "test"; id: string; fiveRM: number; date: string };
type SessionInit = { kind: "session"; id: string; type: string; rpe: number; durationMin: number; date: string };

// Coach-only Edit / Delete controls for one row of an athlete's weekly log.
export default function EntryActions(props: TestInit | SessionInit) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState(props.date);
  const [five, setFive] = useState(props.kind === "test" ? String(props.fiveRM) : "");
  const [rpe, setRpe] = useState(props.kind === "session" ? String(props.rpe) : "");
  const [dur, setDur] = useState(props.kind === "session" ? String(props.durationMin) : "");
  const [type, setType] = useState(props.kind === "session" ? props.type : "lift");

  const base = props.kind === "test" ? `/api/tests/${props.id}` : `/api/sessions/${props.id}`;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body =
        props.kind === "test"
          ? { fiveRM: Number(five), date }
          : { rpe: Number(rpe), durationMin: Number(dur), date, type };
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(base, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Couldn't delete.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const input = "bg-bg border border-line rounded-md px-2 py-1.5 num text-sm";

  if (!editing) {
    return (
      <span className="inline-flex gap-3 whitespace-nowrap">
        <button type="button" onClick={() => setEditing(true)} className="text-xs uppercase tracking-wide text-accent font-semibold">
          Edit
        </button>
        <button type="button" onClick={remove} disabled={busy} className="text-xs uppercase tracking-wide text-danger font-semibold disabled:opacity-50">
          Delete
        </button>
        {err && <span className="text-xs text-danger">{err}</span>}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
      {props.kind === "test" ? (
        <label className="flex items-center gap-1 text-xs text-muted">
          5RM
          <input type="number" step="any" min={1} className={`${input} w-24`} value={five} onChange={(e) => setFive(e.target.value)} />
        </label>
      ) : (
        <>
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="lift">Lift</option>
            <option value="practice">Practice</option>
            <option value="game">Game</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-muted">
            RPE
            <input type="number" step="any" min={0} max={10} className={`${input} w-16`} value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            Min
            <input type="number" step="any" min={1} className={`${input} w-20`} value={dur} onChange={(e) => setDur(e.target.value)} />
          </label>
        </>
      )}
      <button type="button" onClick={save} disabled={busy} className="text-xs uppercase tracking-wide text-accent font-semibold disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs uppercase tracking-wide text-muted font-semibold">
        Cancel
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}
