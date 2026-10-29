// The non-barbell content of a Phase 1 / Phase 2 training day, transcribed
// from the Phase 1 and Phase 2 Coaching Copies and wall posters: the NMT
// warm-up, the accessory circuit, the post-session finisher, and (for the
// Multi-Sport track) the finisher's light overhead-press touch. Pure data +
// builders; lib/plan.ts stitches these around the main lifts.
//
// Every item here is a loggable row (SetLog.lift = item key) so the calendar
// checkmark can require *everything* for the day, not just the barbell work.

import type { PlanExercise, PlanSection, EntryKind } from "./plan";

export type DayId = "A" | "B" | "C" | "D" | "MS1" | "MS2";

export type SessionCtx = {
  phase: 1 | 2;
  week: number; // week number within the phase (Week 1 = Testing Week)
  dayId: DayId;
  skill: boolean; // skill-position athletes swap one circuit station for the Jump Station (Phase 1 only)
  beforeRetest: boolean; // the training week immediately before a retest week
};

export type SessionExtras = {
  warmup: PlanExercise[];
  accessory: PlanExercise[];
  finisher: PlanExercise[];
  notes: Partial<Record<PlanSection, string>>;
};

function mk(
  p: Partial<PlanExercise> & Pick<PlanExercise, "lift" | "label" | "section" | "entry">
): PlanExercise {
  return {
    e1Lift: null,
    sets: 1,
    reps: "",
    pctE1RM: null,
    atTestedWeight: false,
    backoff: null,
    ramp: false,
    ...p,
  };
}

const chk = (lift: string, label: string, section: PlanSection, extra: Partial<PlanExercise> = {}) =>
  mk({ lift, label, section, entry: "check", ...extra });

// Display-only item: shown so athletes know it is part of the day, never logged
// and never counted toward completion (sets = 0). The warm-up is usually run as a team.
const info = (lift: string, label: string, section: PlanSection, extra: Partial<PlanExercise> = {}) =>
  mk({ lift, label, section, entry: "info", sets: 0, ...extra });

// ---------------------------------------------------------------- NMT warm-up

// Trimmed NMT warm-up for the lift-only phases (decided Oct 21, 2026): Part 2 every
// session plus two build-up sprints. Part 1 (activation jog/shuffle) and the rest of
// Part 3 (bounding, plant-and-cut) come back in Phases 3-4, which are not encoded here.
// A coaching decision to shorten the protocol, not an evidence-tested one.
const PART3 = [
  "Build-up sprints, 2 reps: jog to stride to ~85-90% effort over ~20 yards on a clear lane. Never all-out.",
];

// Nordic hamstring lower: 2 sets, twice a week (Day B and Day D, after the lift).
// Reps per set: 4-6 (Phase 1 weeks 1-3), 6-8 (weeks 4-6), 8-10 (week 7 on, and all of Phase 2).
export function nordicReps(phase: 1 | 2, week: number): string {
  if (phase === 2) return "8-10";
  if (week <= 3) return "4-6";
  if (week <= 6) return "6-8";
  return "8-10";
}

function warmup(ctx: SessionCtx): PlanExercise[] {
  // Phase 1 only: Day C/D keep the lateral bound in the warm-up; Day A/B and both
  // Multi-Sport days move it after lifting. Phase 2 has no lateral bound.
  const lateralPre = ctx.phase === 1 && (ctx.dayId === "C" || ctx.dayId === "D");

  const part2 = [
    "Plank hold with alternating shoulder taps, 20-30 sec (2 sets)",
    "Side plank each side, 20-30 sec (2 sets)",
    "Neck 4-way isometric hold: press your own flat hand against forehead, back of head and each side, 6-8 sec each direction (1 set)",
    "Single-leg balance reach (touch cone/ball in front, side, back), 6-8 reps per leg (2 sets)",
    "Bodyweight squat to calf/toe raise, 10 reps (2 sets)",
  ];

  // Phase 1 Day C/D: the lateral bound sits in the warm-up (after Part 2, before Part 3).
  if (lateralPre) part2.push("Lateral bound, stick the landing, 6-8 per side");

  return [
    info("wu_part2", "NMT Part 2 - Core, neck, balance & landing (about 4 min)", "warmup", { details: part2 }),
    info("wu_part3", "NMT Part 3 - Build-up sprints (about 1 min)", "warmup", { details: PART3 }),
  ];
}

// ------------------------------------------------------------ finisher blocks

function finisher(ctx: SessionCtx): PlanExercise[] {
  const out: PlanExercise[] = [
    mk({
      lift: "shoulder_health",
      label: "Shoulder-health work (face pull or band pull-apart)",
      section: "finisher",
      entry: "reps",
      sets: 2,
      reps: "15-20",
      note: "Light band or low cable pulley. Stays at 2 x 15-20 all phase.",
    }),
  ];

  if (ctx.dayId === "MS1") {
    if (ctx.beforeRetest) {
      out.push(
        mk({
          lift: "ms_ohp_barbell",
          label: "Barbell Overhead Press (retest re-acquaintance)",
          section: "finisher",
          entry: "weight",
          sets: 2,
          reps: "5",
          note: "Found weight, clearly submaximal (RPE 5-6, empty bar or close to it). Technique under the bar you test with next week - not a loading set.",
        })
      );
    } else {
      out.push(
        mk({
          lift: "ms_ohp_db",
          label: "Light Dumbbell Overhead Press",
          section: "finisher",
          entry: "weight",
          sets: 2,
          reps: "10-12",
          note: "Found weight, well submaximal - a maintenance touch, not a loading stimulus.",
        })
      );
    }
  }

  const lateralPost = ctx.phase === 1 && (ctx.dayId === "A" || ctx.dayId === "B" || ctx.dayId === "MS1" || ctx.dayId === "MS2");
  if (lateralPost) {
    out.push(
      chk("lateral_bound", "Lateral bound, stick the landing (6-8 per side)", "finisher", {
        note: "After lifting on squat/hinge days so it doesn't pre-fatigue the hips and core you need for the main lift.",
      })
    );
  }

  // Twice a week only: Day B and Day D (Multi-Sport: the hinge day, Track Day 2).
  const nordicPost = ctx.dayId === "B" || ctx.dayId === "D" || ctx.dayId === "MS2";
  if (nordicPost) {
    out.push(
      mk({
        lift: "nordic",
        label: "Nordic hamstring lower",
        section: "finisher",
        entry: "reps",
        sets: 2,
        reps: nordicReps(ctx.phase, ctx.week),
        note: "2 sets, after the lift. Partner holds ankles; lower slowly to the ground. Regress to a shorter range if you aren't ready for full range. Skip it and tell the athletic trainer if you have more than mild next-day hamstring soreness, tightness while sprinting, or notice you are slower.",
      })
    );
  }
  return out;
}

// ------------------------------------------------------------ accessory circuit

function jumpStation(): PlanExercise {
  return chk("acc_jump_station", "Jump Station (replaces one circuit station for skill positions)", "accessory", {
    details: [
      "Pick one for the week and keep it consistent.",
      "Box Jump: 3 sets x 5 reps, 12-18 inch box. Jump up and land softly with both feet flat; step down one foot at a time.",
      "OR Hop Series, 2 rounds: Lateral Hop over a cone x 8, Forward-Back Hop over a cone x 8, Single-Leg Hop for distance x 5 per leg (stick each landing).",
    ],
    note: "Check this off when you've finished the whole jump station.",
  });
}

const w = (lift: string, label: string, reps: string, extra: Partial<PlanExercise> = {}) =>
  mk({ lift, label, section: "accessory", entry: "weight", sets: 3, reps, ...extra });
const r = (lift: string, label: string, reps: string, extra: Partial<PlanExercise> = {}) =>
  mk({ lift, label, section: "accessory", entry: "reps", sets: 3, reps, ...extra });

function accessories(ctx: SessionCtx): PlanExercise[] {
  const p1 = ctx.phase === 1;
  const swap = p1 && ctx.skill;
  switch (ctx.dayId) {
    case "A":
      return p1
        ? [
            w("acc_db_bench", "Dumbbell Bench Press", "12-15"),
            w("acc_cable_row", "Cable Row", "12-15"),
            mk({ lift: "acc_plank", label: "Plank / Core", section: "accessory", entry: "time", sets: 3, reps: "30-45", unit: "sec" }),
            swap ? jumpStation() : w("acc_calf_raise", "Calf Raise", "12-15", { allowBodyweight: true }),
          ]
        : [
            w("acc_split_squat", "Split Squat", "10-12", { unit: "per leg", allowBodyweight: true, note: "COD / deceleration" }),
            mk({ lift: "acc_plank", label: "Plank / Core", section: "accessory", entry: "time", sets: 3, reps: "30-45", unit: "sec" }),
            w("acc_calf_raise", "Calf Raise", "12-15", { allowBodyweight: true }),
          ];
    case "B":
      return p1
        ? [
            w("acc_db_ohp", "Dumbbell Overhead Press", "12-15"),
            r("acc_pullup_band", "Pull-up or Band-Assisted Pull-up", "8-12", {
              note: "Bar-based, not the cable machine. Stop each set with ~2-3 clean reps left. Band tension is the variable: too easy means a lighter band, can't reach 8 means a heavier band.",
            }),
            swap ? jumpStation() : w("acc_leg_press", "Leg Press", "12-15"),
            r("acc_pallof", "Band Pallof Press", "10-12", { unit: "per side", note: "Band anchored to a rack." }),
          ]
        : [
            w("acc_db_ohp", "Dumbbell Overhead Press", "12-15"),
            r("acc_pullup_band", "Pull-up or Band-Assisted Pull-up", "8-12", {
              note: "Same band-tension method as Phase 1: stop ~2-3 clean reps short of failure.",
            }),
            w("acc_lateral_lunge", "Lateral Lunge", "10-12", { unit: "per leg", allowBodyweight: true, note: "COD" }),
            r("acc_pallof", "Band Pallof Press", "10-12", { unit: "per side", note: "Band anchored to a rack." }),
          ];
    case "C":
      return [
        w("acc_front_squat", "Front Squat or Goblet Squat", "12-15", { note: "Lighter, technique-focused." }),
        w("acc_db_row", "Dumbbell Row", "12-15"),
        swap ? jumpStation() : w("acc_walking_lunge", "Walking Lunge", "10-12", { unit: "per leg", allowBodyweight: true }),
        r("acc_knee_raise", "Hanging Knee Raise", "10-15", { note: "Reverse Crunch on the floor if there's no bar free." }),
      ];
    case "D":
      return p1
        ? [
            w("acc_sl_rdl", "Single-leg Romanian Deadlift", "10-12", { unit: "per leg", allowBodyweight: true }),
            swap ? jumpStation() : w("acc_step_up", "Step-up", "10-12", { unit: "per leg", allowBodyweight: true }),
            w("acc_woodchop", "Cable Woodchopper", "10-12", { unit: "per side", note: "Band woodchopper anchored to a rack works too." }),
          ]
        : [
            w("acc_sl_rdl", "Single-leg Romanian Deadlift", "10-12", { unit: "per leg", allowBodyweight: true }),
            w("acc_step_up", "Step-up", "10-12", { unit: "per leg", allowBodyweight: true }),
            mk({ lift: "acc_side_plank", label: "Side Plank", section: "accessory", entry: "time", sets: 3, reps: "30-45", unit: "sec per side" }),
          ];
    default:
      return []; // Multi-Sport tracks have no accessory circuit
  }
}

function accessoryNote(ctx: SessionCtx): string | undefined {
  if (ctx.dayId === "MS1" || ctx.dayId === "MS2") return undefined;
  const base =
    "True circuit: go through the stations in order, then repeat for 3 rounds in total. Each station row below is one round. Found weight: pick a weight where the last 1-2 reps of the last round are hard but form holds (~2-3 reps in reserve). Write it down, and add weight next week once all 3 rounds feel clearly easy. Bodyweight only? Leave weight blank and enter reps.";
  return base;
}

export function buildSessionExtras(ctx: SessionCtx): SessionExtras {
  return {
    warmup: warmup(ctx),
    accessory: accessories(ctx),
    finisher: finisher(ctx),
    notes: {
      warmup: "Trimmed NMT warm-up (about 5 min, every session): Part 2 plus two build-up sprints, usually run together as a team. Nothing to check off here - it is on the page so you know it is part of the day.",
      accessory: accessoryNote(ctx),
    },
  };
}


// ------------------------------------------------- Phase 4 (in-season) display-only extras
// In-season lift days carry the trimmed NMT warm-up and the post-lift finisher (shoulder-health work,
// then the Nordic hamstring lower). Coaches are present for both, so none of it is logged: it is on the
// page so the athlete knows it is part of the day. Only the barbell numbers are entered.
export function inSeasonExtras(): SessionExtras {
  return {
    warmup: warmup({ phase: 2, week: 1, dayId: "A", skill: false, beforeRetest: false }),
    accessory: [],
    finisher: [
      info("shoulder_health", "Shoulder-health work (face pull or band pull-apart), 2 x 15-20", "finisher", {
        details: ["Light band or low cable pulley. Done after the lifts, before the Nordic."],
      }),
      info("nordic", "Nordic hamstring lower, 2 x 6-8", "finisher", {
        details: [
          "Two lift days a week only (never on consecutive days).",
          "A first-time athlete with fewer than 7 completed Nordic sessions does 2 x 4-6 for sessions 1-6, then 2 x 6-8.",
        ],
      }),
    ],
    notes: {
      warmup: "Trimmed NMT warm-up (about 5-7 min): Part 2 plus two build-up sprints, run with the team before practice every practice day. Nothing to check off - it is on the page so you know it is part of the day.",
      finisher: "Your coach runs these with you. Nothing to log - just do them after the lifts.",
    },
  };
}

// Human labels for every storage key, so the calendar can show what was logged.
export const ITEM_LABEL: Record<string, string> = {
  wu_part1: "NMT Part 1 (retired Oct 21, 2026)",
  wu_part2: "NMT Part 2",
  wu_part3: "NMT Part 3",
  nordic: "Nordic hamstring lower",
  lateral_bound: "Lateral bound",
  shoulder_health: "Shoulder-health work",
  ms_ohp_db: "Light DB Overhead Press",
  ms_ohp_barbell: "Barbell Overhead Press (technique)",
  acc_jump_station: "Jump Station",
  acc_db_bench: "Dumbbell Bench Press",
  acc_cable_row: "Cable Row",
  acc_plank: "Plank / Core",
  acc_calf_raise: "Calf Raise",
  acc_split_squat: "Split Squat",
  acc_db_ohp: "Dumbbell Overhead Press",
  acc_pullup_band: "Pull-up / Band-Assisted",
  acc_leg_press: "Leg Press",
  acc_pallof: "Band Pallof Press",
  acc_lateral_lunge: "Lateral Lunge",
  acc_front_squat: "Front / Goblet Squat",
  acc_db_row: "Dumbbell Row",
  acc_walking_lunge: "Walking Lunge",
  acc_knee_raise: "Hanging Knee Raise",
  acc_sl_rdl: "Single-leg RDL",
  acc_step_up: "Step-up",
  acc_woodchop: "Cable Woodchopper",
  acc_side_plank: "Side Plank",
  pl_jump_squat: "Trap Bar Jump Squat",
  pl_jump_shrug: "Trap Bar Jump Shrug",
  pl_cat_bench: "CAT Bench Press",
  pl_rotational: "Rotational Power",
  sled_pull: "Sled pulls",
};

// Storage keys whose rows are done/not-done checkboxes or timed holds, so
// summaries can print "done" / "30 sec" instead of "1 reps".
export const CHECK_KEYS = new Set(["wu_part1", "wu_part2", "wu_part3", "lateral_bound", "acc_jump_station"]);
export const TIME_KEYS = new Set(["acc_plank", "acc_side_plank"]);

export type { EntryKind };
