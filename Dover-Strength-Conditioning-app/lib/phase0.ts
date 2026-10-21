// Phase 0 (Transition & Pre-Testing Prep) is display-only in the app: a weekly outline of the
// coach-run sessions with the actual exercises, laid out like the Phase 1 day cards but with nothing
// to log (the sessions are optional; attendance is taken on the coach Attendance page).
// Transcribed from the Pre-Testing Prep wall poster and Program Design section 3.
// Dates assume the final game is Sunday Oct 25, 2026; if a consolation game moves the final
// game a week later, Phase 0's first week is Nov 2 and the first two (recovery) weeks shrink to one.

export type Phase0Item = { name: string; detail?: string };
export type Phase0Block = { heading: string; intro?: string; items: Phase0Item[] };
export type Phase0Day = { day: string; blocks: Phase0Block[] };

export type Phase0Week = {
  label: string;
  dates: string;
  title: string;
  note?: string;
  days: Phase0Day[]; // empty for the recovery weeks
  footer?: string[];
};

const WARMUP: Phase0Block = {
  heading: "Warm-up (NMT) - do before everything else",
  intro: "Trimmed NMT warm-up, about 5 min, every session: Part 2 plus two build-up sprints. Usually run together as a team.",
  items: [
    { name: "Plank hold with alternating shoulder taps", detail: "20-30 sec, 2 sets" },
    { name: "Side plank each side", detail: "20-30 sec, 2 sets" },
    { name: "Neck 4-way isometric hold", detail: "Press your own flat hand against forehead, back of head and each side, 6-8 sec each direction, 1 set" },
    { name: "Single-leg balance reach", detail: "Touch cone/ball in front, side, back; 6-8 reps per leg, 2 sets" },
    { name: "Bodyweight squat to calf/toe raise", detail: "10 reps, 2 sets" },
    { name: "Build-up sprints", detail: "2 reps: jog to stride to about 85-90% effort over about 20 yards. Never all-out." },
  ],
};

const CIRCUIT = (rounds: string, title = "Circuit"): Phase0Block => ({
  heading: `${title} - ${rounds}`,
  intro: "Go through the stations in order, then repeat. Technique over speed.",
  items: [
    { name: "Bodyweight / goblet-hold squat", detail: "10-12 reps. Technique focus, not load" },
    { name: "Push-up", detail: "10-12 reps. Regress to knees if needed" },
    { name: "Bodyweight row or band pull-apart", detail: "10-12 reps. Whichever equipment is free" },
    { name: "Bodyweight RDL reach", detail: "8-10 reps per side. Hip hinge pattern, no load" },
    { name: "Plank", detail: "20-30 sec. Front or side" },
  ],
});

const EASY_COND = (min: string): Phase0Block => ({
  heading: "Finisher - easy conditioning",
  items: [{ name: `${min} of easy-paced conditioning`, detail: "Jog, bike or sled push. Conversational effort, not intervals" }],
});

const lift = (name: string, sets: string, intensity: string): Phase0Item => ({ name, detail: `${sets}. ${intensity}` });

const GENERAL_FOOTER = [
  "RPE = effort on a 1-10 scale. 10 = max, no reps left; 8-9 = 1-2 reps left; 6-7 = several reps left; 3-5 = light, technique only. Every barbell touch in Phase 0 stays at RPE 5-6 or below.",
  "Stop and tell the athletic trainer if anything hurts or feels wrong. A suspected concussion means stop immediately, no same-day return, and no lifting until medical clearance is complete. Coaches don't diagnose or clear anyone.",
];

export const PHASE0_WEEKS: Phase0Week[] = [
  {
    label: "Week 1 - Recovery",
    dates: "Oct 26 - Nov 1, 2026",
    title: "Active recovery",
    note: "Physical and mental recovery after the season. No formal training, nothing expected. If something hurts, tell the athletic trainer.",
    days: [],
  },
  {
    label: "Week 2 - Recovery",
    dates: "Nov 2 - Nov 8, 2026",
    title: "Active recovery",
    note: "Still recovery. Pre-Testing Prep sessions start next week and are optional.",
    days: [],
  },
  {
    label: "Week 3 - Prep Week 1",
    dates: "Nov 9 - Nov 15, 2026",
    title: "General reactivation",
    note: "Optional, coach-run, Tuesday and Thursday, about 30-35 min. Bodyweight only, no barbell. Attendance does not affect roster status or playing time.",
    days: [
      { day: "Tuesday, Nov 10", blocks: [WARMUP, CIRCUIT("2-3 rounds"), EASY_COND("10-12 min")] },
      { day: "Thursday, Nov 12", blocks: [WARMUP, CIRCUIT("2-3 rounds"), EASY_COND("10-12 min")] },
    ],
    footer: GENERAL_FOOTER,
  },
  {
    label: "Week 4 - Prep Week 2",
    dates: "Nov 16 - Nov 22, 2026",
    title: "Movement re-familiarization",
    note: "Optional, Tuesday and Thursday. The barbell comes back, empty bar only, technique only.",
    days: [
      {
        day: "Tuesday, Nov 17",
        blocks: [
          WARMUP,
          CIRCUIT("2-3 rounds"),
          { heading: "Barbell - technique only", items: [lift("Back squat", "2x5", "Empty bar (about 45 lb), RPE 3-4"), lift("Bench press", "2x5", "Empty bar (about 45 lb), RPE 3-4")] },
          EASY_COND("10 min"),
        ],
      },
      {
        day: "Thursday, Nov 19",
        blocks: [
          WARMUP,
          CIRCUIT("2-3 rounds"),
          { heading: "Barbell - technique only", items: [lift("Back squat", "2x5", "Empty bar (about 45 lb), RPE 3-4"), lift("Bench press", "2x5", "Empty bar (about 45 lb), RPE 3-4")] },
          EASY_COND("10 min"),
        ],
      },
    ],
    footer: GENERAL_FOOTER,
  },
  {
    label: "Week 5 - Prep Week 3",
    dates: "Nov 23 - Nov 29, 2026",
    title: "Hold steady, short week",
    note: "Thanksgiving Break (Nov 26-27) cuts Thursday, so there is one session. No barbell this week and no finisher: let the break do the recovery work.",
    days: [{ day: "Tuesday, Nov 24", blocks: [WARMUP, CIRCUIT("2-3 rounds")] }],
    footer: GENERAL_FOOTER,
  },
  {
    label: "Week 6 - Prep Week 4",
    dates: "Nov 30 - Dec 6, 2026",
    title: "Light barbell touches, all four lifts",
    note: "RPE 5-6 only, well short of a working set. Bar-path familiarity is the point, not load.",
    days: [
      {
        day: "Tuesday, Dec 1",
        blocks: [
          WARMUP,
          { heading: "Barbell - light touches", items: [lift("Back squat", "2-3x5", "RPE 5-6"), lift("Bench press", "2-3x5", "RPE 5-6")] },
          CIRCUIT("1-2 rounds, short", "Bodyweight accessory circuit"),
        ],
      },
      {
        day: "Thursday, Dec 3",
        blocks: [
          WARMUP,
          { heading: "Barbell - light touches", items: [lift("Deadlift", "2-3x5", "RPE 5-6"), lift("Overhead press", "2-3x5", "RPE 5-6")] },
          CIRCUIT("1-2 rounds, short", "Bodyweight accessory circuit"),
        ],
      },
    ],
    footer: GENERAL_FOOTER,
  },
  {
    label: "Week 7 - Prep Week 5",
    dates: "Dec 7 - Dec 13, 2026",
    title: "Testing Week lead-in",
    note: "This is the acclimation window before Testing Week. No conditioning and no extra volume: arrive fresh and technically sharp. Testing Week opens Monday, Dec 14.",
    days: [
      {
        day: "Tuesday, Dec 8",
        blocks: [
          WARMUP,
          { heading: "Barbell - brief movement screen", items: [lift("Back squat", "1-2x5", "RPE 4-5"), lift("Bench press", "1-2x5", "RPE 4-5")] },
        ],
      },
      {
        day: "Thursday, Dec 10",
        blocks: [
          WARMUP,
          { heading: "Barbell - brief movement screen", items: [lift("Deadlift", "1-2x5", "RPE 4-5"), lift("Overhead press", "1-2x5", "RPE 4-5")] },
        ],
      },
    ],
    footer: [
      "Fewer than four Prep sessions attended in total? You will not take a heavy 5RM in Testing Week. Your coach will have you work up to one top set of 5 at RPE 7-8, and you test properly at the Week 6 retest or later.",
      ...GENERAL_FOOTER,
    ],
  },
];

export function phase0Week(week: number): Phase0Week | null {
  return PHASE0_WEEKS[Math.min(Math.max(week, 1), PHASE0_WEEKS.length) - 1] ?? null;
}
