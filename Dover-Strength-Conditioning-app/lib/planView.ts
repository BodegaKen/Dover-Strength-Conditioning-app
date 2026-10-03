// Server-side helpers that turn a PlanExercise + the athlete's latest tests
// into the plain-data ExerciseView the SetLogger client component renders.
import { computeTargetWeight } from "./prescription";
import { round2_5 } from "./calc";
import type { PlanExercise } from "./plan";
import type { ExerciseView } from "@/app/dashboard/SetLogger";

export type LatestTest = { e1RM: number; fiveRM: number };

// "70-75 (or RPE 7)" -> "70-75"; 75 -> 75; anything unparseable -> null
export function leadingPct(p: number | string | null | undefined): number | string | null {
  if (p == null) return null;
  if (typeof p === "number") return p;
  const m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/.exec(p.trim());
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : parseFloat(m[1]);
}

export function pctLabel(p: number | string | null | undefined): string {
  if (p == null) return "";
  if (typeof p === "number") return `${p}% e1RM`;
  const m = /^([\d.]+(?:\s*-\s*[\d.]+)?)(.*)$/.exec(p.trim());
  return m ? `${m[1]}% e1RM${m[2]}` : p;
}

function targetOf(e1rm: number | undefined, pct: number | string | null | undefined) {
  if (e1rm == null) return null;
  const t = computeTargetWeight(e1rm, leadingPct(pct));
  if (!t) return null;
  return { text: t.high ? `${t.low}-${t.high}` : `${t.low}`, first: t.low };
}

export function viewOf(ex: PlanExercise, latest: Record<string, LatestTest | undefined>): ExerciseView {
  const src = ex.e1Lift ? latest[ex.e1Lift] : undefined;
  const e1 = src?.e1RM;
  let target = ex.entry === "weight" ? targetOf(e1, ex.pctE1RM) : null;
  if (ex.atTestedWeight && src) target = { text: `${src.fiveRM}`, first: src.fiveRM };
  const bo = ex.backoff ? targetOf(e1, ex.backoff.pctE1RM) : null;

  let ramp: string | undefined;
  if (ex.ramp) {
    ramp =
      e1 != null
        ? `50% x5 (${round2_5(e1 * 0.5)}) · 65% x3 (${round2_5(e1 * 0.65)}) · 75% x2 (${round2_5(e1 * 0.75)}) lb`
        : "50% x5 · 65% x3 · 75% x2 of your e1RM";
  }

  const needsMax = ex.entry === "weight" && !!ex.e1Lift && (ex.pctE1RM != null || ex.atTestedWeight);
  return {
    lift: ex.lift,
    label: ex.label,
    section: ex.section,
    sets: ex.sets,
    reps: ex.reps,
    unit: ex.unit,
    pctLabel: ex.atTestedWeight ? "tested added weight" : pctLabel(ex.pctE1RM),
    target: target?.text ?? null,
    targetFirst: target?.first ?? null,
    entry: ex.entry,
    allowBodyweight: ex.allowBodyweight,
    backoff: ex.backoff
      ? { sets: ex.backoff.sets, reps: ex.backoff.reps, pctLabel: pctLabel(ex.backoff.pctE1RM), target: bo?.text ?? null }
      : null,
    ramp,
    note: ex.note,
    details: ex.details,
    hint: needsMax && target == null && e1 == null ? "Log a test max to see your target weight." : undefined,
  };
}
