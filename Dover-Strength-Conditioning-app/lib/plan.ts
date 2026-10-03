// Turns a program period (one week of lifts from data/program-data.json) into
// the concrete list of days and exercises an athlete actually logs against,
// taking their assigned track (full vs. Multi-Sport) and pull-up track into
// account. Pure functions only - the dashboard, the logging API and the
// calendar all call these so "what counts as a completed day" is defined once.

import type { Period, RawLift } from "./prescription";
import { LIFTS, type LiftKey } from "./calc";

export type TrainingTrack = "FULL" | "MULTI_SPORT";
export type PullupMode = "BODYWEIGHT" | "WEIGHTED";

export const BACKOFF_BASE = 100; // back-off sets are stored as setNumber 101, 102...

export type PlanExercise = {
  lift: LiftKey;
  label: string;
  sets: number; // required work sets
  reps: string; // as prescribed, e.g. "5", "3-5", "max"
  pctE1RM: number | string | null;
  atTestedWeight: boolean; // pull-up phases that say "at tested added weight"
  entry: "weight" | "reps"; // bodyweight pull-ups log reps only
  backoff: { sets: number; reps: string; pctE1RM: number | string | null } | null;
  note?: string;
};

export type PlanDay = {
  day: string;
  isTest: boolean;
  exercises: PlanExercise[];
};

export type LoggedSet = {
  lift: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function asCount(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function exerciseFor(
  key: LiftKey,
  label: string,
  lift: RawLift,
  pullupMode: PullupMode,
  variant: TrainingTrack,
  multiSportEligible: boolean
): PlanExercise | null {
  const cap = (n: number) => (variant === "MULTI_SPORT" && multiSportEligible ? Math.min(n, 3) : n);

  if (key === "pullup") {
    const wantWeighted = pullupMode === "WEIGHTED" && !!lift.weightedPlan;
    if (wantWeighted && lift.weightedPlan) {
      const w = lift.weightedPlan;
      return {
        lift: key,
        label: "Weighted Pull-up",
        sets: cap(w.sets),
        reps: String(w.reps),
        pctE1RM: w.pctE1RM ?? null,
        atTestedWeight: !!w.atTestedWeight,
        entry: "weight",
        backoff: null,
        note: lift.note ?? undefined,
      };
    }
    const b = lift.bodyweightPlan;
    if (!b) return null;
    return {
      lift: key,
      label: "Pull-up (bodyweight / assisted)",
      sets: b.sets,
      reps: String(b.reps),
      pctE1RM: null,
      atTestedWeight: false,
      entry: "reps",
      backoff: null,
      note: lift.note ?? undefined,
    };
  }

  const sets = asCount(lift.sets);
  if (sets == null) return null;
  const bo = lift.backoff;
  const boSets = bo ? asCount(bo.sets) : null;
  return {
    lift: key,
    label,
    sets: cap(sets),
    reps: String(lift.reps ?? ""),
    pctE1RM: lift.pctE1RM ?? null,
    atTestedWeight: false,
    entry: "weight",
    backoff: bo && boSets ? { sets: boSets, reps: String(bo.reps ?? ""), pctE1RM: bo.pctE1RM ?? null } : null,
    note: lift.note ?? undefined,
  };
}

export function buildPlanDays(args: {
  trackKey: string;
  period: Period | undefined;
  variant: TrainingTrack;
  pullupMode: PullupMode;
}): PlanDay[] {
  const { trackKey, period, variant, pullupMode } = args;
  if (!period) return [];
  const lifts = period.lifts ?? {};

  const isTestWeek = LIFTS.some((l) => {
    const m = (lifts[l.key] as RawLift | undefined)?.mode;
    return m === "test" || m === "retest";
  });

  // Multi-Sport Maintenance Track only exists in Phase 1 and Phase 2's
  // training weeks: 2 days (Squat+Bench / Deadlift+Pull-up), work sets capped
  // at 3, no Overhead Press line. Testing weeks keep their normal test days.
  const multiSport = variant === "MULTI_SPORT" && (trackKey === "phase1" || trackKey === "phase2") && !isTestWeek;

  const byDay = new Map<string, PlanDay>();
  for (const l of LIFTS) {
    const lift = lifts[l.key] as RawLift | undefined;
    if (!lift) continue;
    if (multiSport && l.key === "ohp") continue;

    let dayName = lift.day ?? "Session";
    if (multiSport) dayName = l.key === "squat" || l.key === "bench" ? "Track Day 1" : "Track Day 2";

    const testLift = lift.mode === "test" || lift.mode === "retest";
    if (testLift) {
      const d = byDay.get(dayName) ?? { day: dayName, isTest: true, exercises: [] };
      byDay.set(dayName, d);
      continue; // test days list their lifts via the existing test cards, not set rows
    }
    const ex = exerciseFor(l.key, l.label, lift, pullupMode, variant, multiSport);
    if (!ex) continue;
    const d = byDay.get(dayName) ?? { day: dayName, isTest: false, exercises: [] };
    d.exercises.push(ex);
    byDay.set(dayName, d);
  }

  return Array.from(byDay.values()).sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    // "GD-4 (Lift Day 1)" before "GD-2 (Lift Day 2)", "Track Day 1" before "Track Day 2"
    const an = /Day\s*(\d+)/i.exec(a.day);
    const bn = /Day\s*(\d+)/i.exec(b.day);
    if (an && bn) return Number(an[1]) - Number(bn[1]);
    return a.day.localeCompare(b.day);
  });
}

export function isTestPeriod(period: Period | undefined): boolean {
  if (!period) return false;
  return LIFTS.some((l) => {
    const m = (period.lifts?.[l.key] as RawLift | undefined)?.mode;
    return m === "test" || m === "retest";
  });
}

export type DayProgress = { done: number; total: number; complete: boolean; started: boolean };

// A set counts as logged when it has a weight (weight entries) or reps
// (bodyweight pull-ups). Back-off sets are optional and never block completion.
export function dayProgress(day: PlanDay, logged: LoggedSet[]): DayProgress {
  let done = 0;
  let total = 0;
  let started = false;
  for (const ex of day.exercises) {
    total += ex.sets;
    for (const s of logged) {
      if (s.lift !== ex.lift) continue;
      if (s.setNumber >= 1 && s.setNumber <= ex.sets) {
        const ok = ex.entry === "reps" ? s.reps != null : s.weight != null;
        if (ok) done++;
      }
      started = true;
    }
  }
  return { done, total, complete: total > 0 && done >= total, started };
}
