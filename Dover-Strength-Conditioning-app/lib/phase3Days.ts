// Phase 3 (Early Summer) field days, transcribed from the Phase 3 Coaching Copy.
//
// Rule for what athletes enter: only numbers. The sled load on Day A is the one logged field day item
// (sled_pull). Everything else on these days is display-only ("info"): warm-ups, drills, sprints, tempo
// runs, plyometrics, SIT conditioning, the shoulder-health and Nordic finishers, and the test-day
// stations. Coaches are present for all of it, and the hand-timed speed and shuttle results are entered by
// a coach on the Speed tab. Days with nothing loggable are the days the coach roll call applies to.

import type { PlanDay, PlanExercise, PlanSection } from "./plan";

function item(
  lift: string,
  label: string,
  section: PlanSection,
  details?: string[],
  note?: string
): PlanExercise {
  return {
    lift,
    e1Lift: null,
    section,
    label,
    sets: 0,
    reps: "",
    pctE1RM: null,
    atTestedWeight: false,
    entry: "info",
    ramp: false,
    backoff: null,
    note,
    details,
  };
}

const NMT_FULL = item(
  "p3_nmt",
  "NMT warm-up, all three parts (about 10-13 min)",
  "warmup",
  undefined,
  "Your coach runs it with the team. Nothing to check off - it is on the page so you know it is part of the day."
);

const SHOULDER = item(
  "shoulder_health",
  "Shoulder-health work (face pull or band pull-apart), 2 x 15-20",
  "finisher",
  ["Light band or low cable pulley."]
);

const NORDIC = item("nordic", "Nordic hamstring lower, 2 sets", "finisher", [
  "Returning athletes: 8-10 reps per set.",
  "First-time athletes build by completed Nordic sessions: sessions 1-6 at 2 x 4-6, sessions 7-12 at 2 x 6-8, session 13 on at 2 x 8-10.",
]);

// Sled load by week, as % of the athlete's bodyweight (Progression Scheme).
const SLED: Record<number, { pct: string; reps: string; rest: string; label: string }> = {
  2: { pct: "50-60", reps: "4-6", rest: "2-3 min", label: "Light to moderate." },
  3: { pct: "80-90", reps: "4-5", rest: "2-3 min", label: "Moderate." },
  4: { pct: "90-100", reps: "3", rest: "3+ min", label: "Heavy, technique-gated." },
  5: { pct: "90-100", reps: "3", rest: "3+ min", label: "Hold last week's load, technique-gated." },
};

function dayA(week: number): PlanDay {
  const s = SLED[week] ?? SLED[2];
  const sled: PlanExercise = {
    lift: "sled_pull",
    e1Lift: null,
    section: "main",
    label: "Sled pulls",
    sets: 1,
    reps: s.reps,
    unit: "pulls of 10 m",
    pctE1RM: null,
    pctBW: s.pct,
    atTestedWeight: false,
    entry: "weight",
    ramp: false,
    backoff: null,
    note: `Enter the load you actually pulled and how many pulls. ${s.label} Rest ${s.rest} between pulls - this is a quality day, not a conditioning day. The bodyweight percentage is a guide, not a target to hit at the cost of mechanics: if forward lean or stride breaks down, your coach drops the load 5-10% from that pull on, and you log the lighter number.`,
  };
  return {
    day: "Monday",
    title: "Day A - Acceleration & Sled",
    isTest: false,
    exercises: [
      NMT_FULL,
      item("p3_accel", "Acceleration mechanics (bodyweight, shared block)", "warmup", [
        "Ankle bounces in place, 2 x 15",
        "A-March, 2 x 15 m",
        "A-Skip, 2 x 15 m",
        "Wall drill, 3-position acceleration posture (tall - fall - run), 3 x 5 sec per leg",
        "Falling starts, 3 x 10 m",
      ]),
      sled,
      item("p3_unres", "Unresisted acceleration sprints, 3 x 10-20 m", "main", [
        "Max effort, no sled, right after the sled pulls. Rest 2-3 min between reps.",
      ]),
      item("p3_flying", "Skill positions (WR/DB/RB) only: flying sprints, 2 x 30-40 m", "main", [
        "10 m build-up into 20-30 m at top speed. Rest about 3 min between reps.",
        "Linemen finish after the unresisted sprints.",
      ]),
      SHOULDER,
      NORDIC,
    ],
    notes: {
      main: "Only the sled load is entered. The sprints are run and timed by your coach.",
      finisher: "Your coach runs these with you. Nothing to log.",
    },
  };
}

function dayB(): PlanDay {
  return {
    day: "Tuesday",
    title: "Day B - Tempo & Skills",
    isTest: false,
    exercises: [
      NMT_FULL,
      item("p3_tempo", "Tempo runs, 6-8 x 100 m at about 70-75% effort", "main", [
        "Walk back for recovery. Easy aerobic work - the lightest day of the phase, on purpose.",
      ]),
      item("p3_skills", "Skills circuit: 4 stations", "main", [
        "Backpedal-to-drive sprint (10 m)",
        "Lateral shuffle-to-sprint (10 m)",
        "Footwork ladder (in-in-out-out pattern, 2 passes)",
        "Cone-to-cone 45-degree cut (2 cuts, 10 m total)",
        "Skill positions: all 4 stations, 4 reps each. Linemen: 2 reps at each station, plus 2 extra reps of the backpedal-to-drive station.",
      ]),
    ],
    notes: { main: "Nothing to log today - your coach runs every station with you." },
  };
}

function dayC(week: number): PlanDay {
  const reps = week === 2 ? "4" : "5";
  return {
    day: "Thursday",
    title: "Day C - Plyometrics & SIT Conditioning",
    isTest: false,
    exercises: [
      NMT_FULL,
      item("p3_plyo", "Plyometric circuit", "main", [
        "Box jump, 4 x 5",
        "Standing broad jump, 3 x 5",
        "Single-leg bound, 3 x 5 per leg",
        "Lateral bound, 3 x 6 per side",
        "Raise box height only when landings are quiet and controlled.",
      ]),
      item("p3_sit", `SIT conditioning: 2 sets x ${reps} reps`, "main", [
        "Maximal-effort 20 m out-and-back shuttle sprints (40 m total).",
        "About 30 sec rest between reps, about 3 min between sets. Linemen get roughly 25% longer recovery.",
      ]),
      SHOULDER,
      NORDIC,
    ],
    notes: { main: "Nothing to log today - your coach paces the sets and the rest.", finisher: "Your coach runs these with you. Nothing to log." },
  };
}

function testDays(retest: boolean): PlanDay[] {
  return [
    {
      day: "Monday",
      title: retest ? "Speed Retest" : "Day T1 - Speed test",
      isTest: false,
      exercises: [
        NMT_FULL,
        item("p3_bw", "Bodyweight recorded", "main", ["Your coach records it. Your Day A sled load is a percentage of this number."]),
        item("p3_runway", "Sprint runway first, if you need it", "main", [
          "If you missed the Bridge, are new, or have not sprinted in the last 3 weeks: 4-6 progressive accelerations of 20-30 yards at about 60%, 75%, then 85% effort, walking back between reps, before any timed sprint.",
        ]),
        item("p3_1020", "10 m / 20 m acceleration sprint", "main", [
          "3 attempts, full recovery (3+ min) between, best time at each split counts. Hand-timed, self-start.",
        ]),
        item("p3_40", "40-yard sprint", "main", ["2 attempts, full recovery between, best time counts."]),
      ],
      notes: { main: `Your coach enters your times after ${retest ? "the retest" : "testing"}. They show up in your Progress tab. Nothing for you to log.` },
    },
    {
      day: "Tuesday",
      title: retest ? "Conditioning Retest" : "Day T2 - 300-yard shuttle",
      isTest: false,
      exercises: [
        NMT_FULL,
        item("p3_shuttle", "300-yard shuttle", "main", [
          "Two lines 25 yards apart. Six 50-yard shuttles (out and back, foot touches each line), run continuously with no rest between.",
          "One hand-timed trial, to the nearest 0.1 s. A coach counts shuttles and checks the line touches.",
          retest ? "Athletes without a completed runway skip it." : "First-time athletes and anyone without a completed runway run it Thursday instead.",
          "No lifting after the shuttle. Walk, hydrate, easy mobility.",
        ]),
      ],
      notes: { main: "Your coach enters your time. It shows up in your Progress tab. Nothing for you to log." },
    },
    {
      day: "Thursday",
      title: "Makeups & buffer",
      isTest: false,
      exercises: [
        item("p3_makeup", "Makeup testing and weather/heat buffer", "main", [
          "Your coach tells you if you are on today's list: the makeup shuttle or speed test, or a day lost to heat, weather or illness.",
        ]),
      ],
    },
  ];
}

// The field days (everything except Wednesday's Day D lift) for a Phase 3 period index (1 = Test Week, 2-5, 6 = Retest Week).
export function phase3FieldDays(index: number): PlanDay[] {
  if (index === 1) return testDays(false);
  if (index === 6) return testDays(true);
  return [dayA(index), dayB(), dayC(index)];
}

// Wednesday's Day D lift is built from the program data; these wrap it.
export function phase3DayDWrap(): { warmup: PlanExercise[]; finisher: PlanExercise[]; notes: PlanDay["notes"]; title: string } {
  return {
    title: "Day D - Maintenance Lift",
    warmup: [item("p3_nmt", "NMT warm-up (about 10-13 min)", "warmup", undefined, "Your coach runs it with the team. Nothing to check off.")],
    finisher: [SHOULDER, item("p3_nonordic", "No Nordic hamstring lower on this day", "finisher")],
    notes: { finisher: "Your coach runs the finisher with you. Nothing to log." },
  };
}
