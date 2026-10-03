// Turns a program period (one week of lifts from data/program-data.json) into
// the concrete list of days and exercises an athlete actually logs against,
// taking their assigned track (full vs. Multi-Sport), pull-up track and
// position group into account. Pure functions only - the dashboard, the
// logging API and the calendar all call these so "what counts as a completed
// day" is defined once.
//
// For Phase 1 and 2 training weeks a day is more than the barbell work: it
// also carries the NMT warm-up, the Power Lane (Phase 2), the accessory
// circuit and the post-session finisher (see lib/sessionContent.ts). Every
// one of those is a loggable row, and a day is only complete when all of
// them are logged.

import type { Period, RawLift } from "./prescription";
import { getPeriod } from "./prescription";
import { LIFTS, type LiftKey } from "./calc";
import { buildSessionExtras, ITEM_LABEL, type DayId } from "./sessionContent";

export type TrainingTrack = "FULL" | "MULTI_SPORT";
export type PullupMode = "BODYWEIGHT" | "WEIGHTED";
export type PositionGroup = "LINE" | "SKILL" | "UNKNOWN";
export type EntryKind = "weight" | "reps" | "time" | "check";
export type PlanSection = "warmup" | "main" | "accessory" | "finisher";

export const BACKOFF_BASE = 100; // back-off sets are stored as setNumber 101, 102...

// Deadlift alternates with Romanian Deadlift "every other week" in both
// phases but the written program doesn't say which weeks. Assumption: the
// first training week of each phase is the conventional deadlift (the lift
// that was tested), so conventional on even week numbers, RDL on odd ones.
export const RDL_ON_ODD_WEEKS = true;

export type PlanExercise = {
  lift: string; // storage key: a LiftKey for barbell lifts, or an item key like "acc_cable_row"
  e1Lift: LiftKey | null; // which tested lift's e1RM drives any % target
  section: PlanSection;
  label: string;
  sets: number; // required work sets / rounds (a checkbox item has 1)
  reps: string; // as prescribed, e.g. "5", "3-5", "max", "12-15"
  unit?: string; // "per leg", "per side", "sec"
  pctE1RM: number | string | null;
  atTestedWeight: boolean; // pull-up phases that say "at tested added weight"
  entry: EntryKind; // weight = weight x reps; reps / time = reps (or seconds) only; check = done/not done
  allowBodyweight?: boolean; // weight entry where reps alone also counts (bodyweight allowed)
  optional?: boolean; // never blocks day completion
  ramp: boolean; // show the 50/65/75% ramp sets
  backoff: { sets: number; reps: string; pctE1RM: number | string | null } | null;
  note?: string;
  details?: string[]; // checklist contents for warm-up parts
};

export type PlanDay = {
  day: string;
  isTest: boolean;
  exercises: PlanExercise[];
  notes?: Partial<Record<PlanSection, string>>;
};

export type LoggedSet = {
  lift: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_TO_DAYID: Record<string, DayId> = { Monday: "A", Tuesday: "B", Thursday: "C", Friday: "D" };

// Linemen are the only group the written program singles out by name
// (everyone else is "skill positions"). Free-text positions are matched
// loosely; blank / unrecognised means UNKNOWN and gets the standard station.
export function positionGroup(position: string | null | undefined): PositionGroup {
  const p = (position ?? "").toUpperCase().replace(/[^A-Z]/g, " ").trim();
  if (!p) return "UNKNOWN";
  const tokens = p.split(/\s+/);
  const has = (list: string[]) => tokens.some((t) => list.includes(t));
  // "Tight End" / "TE" is a skill position even though it contains "END".
  if (has(["TE", "TIGHT"])) return "SKILL";
  const LINE = ["OL", "OT", "OG", "C", "DL", "DT", "DE", "NT", "NG", "LINE", "LINEMAN", "LINEMEN", "TACKLE", "GUARD", "CENTER", "END"];
  const SKILL = [
    "QB", "RB", "FB", "WR", "DB", "CB", "S", "FS", "SS", "LB", "ILB", "OLB", "MLB", "WLB", "SLB", "ATH", "K", "P", "KR", "PR",
    "BACK", "BACKER", "LINEBACKER", "RECEIVER", "QUARTERBACK", "SAFETY", "CORNERBACK", "CORNER", "RUNNING", "WIDE",
  ];
  if (has(LINE)) return "LINE";
  if (has(SKILL)) return "SKILL";
  return "UNKNOWN";
}

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
  multiSportEligible: boolean,
  rdlWeek: boolean,
  phaseNum: number
): PlanExercise | null {
  const cap = (n: number) => (variant === "MULTI_SPORT" && multiSportEligible ? Math.min(n, 3) : n);

  if (key === "pullup") {
    const wantWeighted = pullupMode === "WEIGHTED" && !!lift.weightedPlan;
    if (wantWeighted && lift.weightedPlan) {
      const w = lift.weightedPlan;
      return {
        lift: key,
        e1Lift: "pullup",
        section: "main",
        label: "Weighted Pull-up",
        sets: cap(w.sets),
        reps: String(w.reps),
        pctE1RM: w.pctE1RM ?? null,
        atTestedWeight: !!w.atTestedWeight,
        entry: "weight",
        ramp: false,
        backoff: null,
        note: lift.note ?? undefined,
      };
    }
    const b = lift.bodyweightPlan;
    if (!b) return null;
    return {
      lift: key,
      e1Lift: null,
      section: "main",
      label: "Pull-up (bodyweight / assisted)",
      sets: b.sets,
      reps: String(b.reps),
      pctE1RM: null,
      atTestedWeight: false,
      entry: "reps",
      ramp: false,
      backoff: null,
      note: lift.note ?? undefined,
    };
  }

  const sets = asCount(lift.sets);
  if (sets == null) return null;
  const bo = lift.backoff;
  const boSets = bo ? asCount(bo.sets) : null;
  const isDeadlift = key === "deadlift";
  const isOhpAccessory = key === "ohp" && phaseNum > 0;
  let note = lift.note ?? undefined;
  if (isDeadlift && rdlWeek) {
    note =
      "Romanian Deadlift week. The % below is a ceiling, not a target - RDL usually comes in lighter, so let form set the weight. " +
      (note ?? "");
  }
  return {
    lift: key,
    e1Lift: key,
    section: "main",
    label: isDeadlift && rdlWeek ? "Romanian Deadlift (RDL)" : isOhpAccessory ? "Overhead Press (barbell)" : label,
    sets: cap(sets),
    reps: String(lift.reps ?? ""),
    pctE1RM: lift.pctE1RM ?? null,
    atTestedWeight: false,
    entry: "weight",
    ramp: key === "squat" || key === "bench" || key === "deadlift",
    backoff: bo && boSets ? { sets: boSets, reps: String(bo.reps ?? ""), pctE1RM: bo.pctE1RM ?? null } : null,
    note,
  };
}

function powerLane(key: LiftKey, lift: RawLift, phaseNum: number): PlanExercise | null {
  if (phaseNum !== 2) return null;
  const base = { section: "main" as const, entry: "weight" as const, atTestedWeight: false, ramp: false, backoff: null, optional: false };
  if (key === "squat") {
    return {
      ...base,
      lift: "pl_jump_squat",
      e1Lift: "squat",
      label: "Power Lane: Trap Bar Jump Squat",
      sets: 5,
      reps: "3",
      pctE1RM: "30-40",
      note: "Light enough that speed, not load, is the point. Max intended bar speed, land soft, rest 2 min. Linemen toward 40%, skill toward 30%. If your coach hasn't cleared you for loaded jumps, do unloaded countermovement jumps and enter 0.",
      allowBodyweight: true,
    };
  }
  if (key === "deadlift") {
    return {
      ...base,
      lift: "pl_jump_shrug",
      e1Lift: "deadlift",
      label: "Power Lane: Trap Bar Jump Shrug",
      sets: 5,
      reps: "3",
      pctE1RM: "30-40",
      note: "Explosive hip-hinge to triple extension - shrug and let the bar float, land soft, rest 2 min. Linemen toward 40%, skill toward 30%. Not cleared for loaded jumps? Do unloaded and enter 0.",
      allowBodyweight: true,
    };
  }
  if (key === "bench" && lift.powerLaneCAT) {
    const c = lift.powerLaneCAT;
    const sets = asCount(c.sets);
    if (!sets) return null;
    return {
      ...base,
      lift: "pl_cat_bench",
      e1Lift: "bench",
      label: "Power Lane: CAT Bench Press",
      sets,
      reps: String(c.reps ?? "3"),
      pctE1RM: c.pctE1RM ?? null,
      note: "Maximal intended bar speed, full range of motion, controlled on the way down. Rest 2 min.",
    };
  }
  return null;
}

function rotationalPower(): PlanExercise {
  return {
    lift: "pl_rotational",
    e1Lift: null,
    section: "main",
    label: "Power Lane: Landmine Rotational Press or Med-Ball Rotational Throw",
    sets: 4,
    reps: "5",
    unit: "per side",
    pctE1RM: null,
    atTestedWeight: false,
    entry: "weight",
    allowBodyweight: true,
    ramp: false,
    backoff: null,
    note: "Pick one for the week and keep it consistent. Maximal explosive intent every rep, rest 90 sec. Enter the implement weight (or 0 if none).",
  };
}

export function isTestPeriod(period: Period | undefined): boolean {
  if (!period) return false;
  return LIFTS.some((l) => {
    const m = (period.lifts?.[l.key] as RawLift | undefined)?.mode;
    return m === "test" || m === "retest";
  });
}

export function buildPlanDays(args: {
  trackKey: string;
  period: Period | undefined;
  variant: TrainingTrack;
  pullupMode: PullupMode;
  position?: string | null;
}): PlanDay[] {
  const { trackKey, period, variant, pullupMode } = args;
  if (!period) return [];
  const lifts = period.lifts ?? {};

  const isTestWeek = isTestPeriod(period);
  const phaseNum = trackKey === "phase1" ? 1 : trackKey === "phase2" ? 2 : 0;
  const week = period.index;
  const rdlWeek = phaseNum > 0 && (week % 2 === 1) === RDL_ON_ODD_WEEKS;
  const skill = positionGroup(args.position) === "SKILL";

  let beforeRetest = false;
  if (phaseNum > 0) {
    const next = getPeriod(trackKey, period.index + 1);
    beforeRetest = !!next && next.index !== period.index && isTestPeriod(next);
  }

  // Multi-Sport Maintenance Track only exists in Phase 1 and Phase 2's
  // training weeks: 2 days (Squat+Bench / Deadlift+Pull-up), work sets capped
  // at 3, no Overhead Press line. Testing weeks keep their normal test days.
  const multiSport = variant === "MULTI_SPORT" && phaseNum > 0 && !isTestWeek;

  const byDay = new Map<string, PlanDay>();
  const dayFor = (name: string, isTest: boolean) => {
    const d = byDay.get(name) ?? { day: name, isTest, exercises: [] };
    byDay.set(name, d);
    return d;
  };

  // OHP last: in Phase 1/2 it is dosed like the circuit's heaviest station,
  // after the day's pull-up and (Phase 2) rotational power work.
  const order = [...LIFTS.filter((l) => l.key !== "ohp"), ...LIFTS.filter((l) => l.key === "ohp")];
  for (const l of order) {
    const lift = lifts[l.key] as RawLift | undefined;
    if (!lift) continue;
    if (multiSport && l.key === "ohp") continue;

    let dayName = lift.day ?? "Session";
    if (multiSport) dayName = l.key === "squat" || l.key === "bench" ? "Track Day 1" : "Track Day 2";

    const testLift = lift.mode === "test" || lift.mode === "retest";
    if (testLift) {
      dayFor(dayName, true);
      continue; // test days list their lifts via the existing test cards, not set rows
    }
    const ex = exerciseFor(l.key, l.label, lift, pullupMode, variant, multiSport, rdlWeek, phaseNum);
    if (!ex) continue;
    const d = dayFor(dayName, false);
    d.exercises.push(ex);
    const pl = powerLane(l.key, lift, phaseNum);
    if (pl) d.exercises.push(pl);
    // Phase 2 Day D: rotational power follows the pull-up, ahead of the OHP station.
    if (phaseNum === 2 && l.key === "pullup" && !multiSport) d.exercises.push(rotationalPower());
  }

  // Wrap the barbell work with the warm-up, accessory circuit and finisher.
  if (phaseNum > 0 && !isTestWeek) {
    for (const d of byDay.values()) {
      if (d.isTest) continue;
      const dayId: DayId | undefined = multiSport
        ? d.day === "Track Day 1"
          ? "MS1"
          : "MS2"
        : WEEKDAY_TO_DAYID[d.day];
      if (!dayId) continue;
      const extras = buildSessionExtras({ phase: phaseNum as 1 | 2, week, dayId, skill, beforeRetest });
      d.exercises = [...extras.warmup, ...d.exercises, ...extras.accessory, ...extras.finisher];
      d.notes = extras.notes;
    }
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

export type DayProgress = { done: number; total: number; complete: boolean; started: boolean };

// Is a given logged row enough to count that set as done?
export function isLoggedRow(ex: PlanExercise, s: { weight: number | null; reps: number | null }): boolean {
  if (ex.entry === "weight") return ex.allowBodyweight ? s.weight != null || s.reps != null : s.weight != null;
  return s.reps != null; // reps, time and check items
}

// A set counts as logged per isLoggedRow. Back-off sets and anything flagged
// optional never block completion.
export function dayProgress(day: PlanDay, logged: LoggedSet[]): DayProgress {
  let done = 0;
  let total = 0;
  let started = false;
  for (const ex of day.exercises) {
    if (!ex.optional) total += ex.sets;
    for (const s of logged) {
      if (s.lift !== ex.lift) continue;
      if (s.setNumber >= 1 && s.setNumber <= ex.sets && !ex.optional) {
        if (isLoggedRow(ex, s)) done++;
      }
      started = true;
    }
  }
  return { done, total, complete: total > 0 && done >= total, started };
}

export function labelForKey(key: string, liftLabels: Record<string, string>): string {
  return ITEM_LABEL[key] ?? liftLabels[key] ?? key;
}
