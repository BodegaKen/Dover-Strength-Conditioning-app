// Phase 0 (Transition & Pre-Testing Prep) is display-only in the app: a weekly outline of what
// the coach-run sessions are, with nothing to log (attendance is taken on the coach Attendance
// page). Transcribed from the Pre-Testing Prep wall poster and Program Design section 3.
// Dates assume the final game is Sunday Oct 25, 2026; if a consolation game moves the final
// game a week later, Phase 0's first week is Nov 2 and the first two (recovery) weeks shrink to one.

export type Phase0Week = {
  label: string;
  dates: string;
  title: string;
  note?: string;
  sessions: string[]; // plain-language lines shown on the athlete's This Week card
};

const WARMUP =
  "Every session opens with the trimmed NMT warm-up (about 5 min): Part 2 (core, neck, balance, landing) plus two build-up sprints.";
const CIRCUIT =
  "Circuit, 2-3 rounds: bodyweight squat (10-12), push-up (10-12), bodyweight row or band pull-apart (10-12), bodyweight RDL reach (8-10 per side), plank (20-30 sec).";

export const PHASE0_WEEKS: Phase0Week[] = [
  {
    label: "Week 1 - Recovery",
    dates: "Oct 26 - Nov 1, 2026",
    title: "Active recovery",
    note: "Physical and mental recovery after the season. No formal training, nothing expected. If something hurts, tell the athletic trainer.",
    sessions: ["No sessions. Move around, sleep, eat. Report any injury to the athletic trainer."],
  },
  {
    label: "Week 2 - Recovery",
    dates: "Nov 2 - Nov 8, 2026",
    title: "Active recovery",
    note: "Still recovery. Pre-Testing Prep sessions start next week and are optional.",
    sessions: ["No sessions. Keep moving, keep sleeping."],
  },
  {
    label: "Week 3 - Prep Week 1",
    dates: "Nov 9 - Nov 15, 2026",
    title: "General reactivation",
    note: "Optional, coach-run, Tuesday and Thursday, about 30-35 min. Attendance does not affect roster status or playing time.",
    sessions: ["Tue Nov 10 and Thu Nov 12. Bodyweight only, no barbell.", WARMUP, CIRCUIT, "Week 1 finisher: 10-12 min easy conditioning (jog, bike or sled push), conversational pace."],
  },
  {
    label: "Week 4 - Prep Week 2",
    dates: "Nov 16 - Nov 22, 2026",
    title: "Movement re-familiarization",
    sessions: [
      "Tue Nov 17 and Thu Nov 19.",
      WARMUP,
      CIRCUIT,
      "Barbell, technique only: back squat 2x5 and bench press 2x5 with the empty bar (about 45 lb), RPE 3-4.",
      "Finisher: 10 min easy conditioning.",
    ],
  },
  {
    label: "Week 5 - Prep Week 3",
    dates: "Nov 23 - Nov 29, 2026",
    title: "Hold steady, short week",
    note: "Thanksgiving Break (Nov 26-27) cuts Thursday, so there is one session.",
    sessions: ["Tue Nov 24 only. Bodyweight only, no barbell, no finisher.", WARMUP, CIRCUIT],
  },
  {
    label: "Week 6 - Prep Week 4",
    dates: "Nov 30 - Dec 6, 2026",
    title: "Light barbell touches, all four lifts",
    sessions: [
      "Tue Dec 1: back squat and bench press, 2-3x5 each. Thu Dec 3: deadlift and overhead press, 2-3x5 each.",
      "RPE 5-6 only, well short of a working set. Bar-path familiarity is the point, not load.",
      WARMUP,
      "Finish each day with a short bodyweight accessory circuit (1-2 rounds).",
    ],
  },
  {
    label: "Week 7 - Prep Week 5",
    dates: "Dec 7 - Dec 13, 2026",
    title: "Testing Week lead-in",
    note: "This is the acclimation window before Testing Week. No conditioning and no extra volume. Testing Week opens Monday, Dec 14.",
    sessions: [
      "Tue Dec 8: back squat and bench press, 1-2x5 each. Thu Dec 10: deadlift and overhead press, 1-2x5 each. RPE 4-5, a brief movement screen.",
      WARMUP,
      "Fewer than four Prep sessions attended in total? You will not take a heavy 5RM in Testing Week; your coach will have you work up to one top set of 5 at RPE 7-8 and test properly at the Week 6 retest or later.",
    ],
  },
];

export function phase0Week(week: number): Phase0Week | null {
  return PHASE0_WEEKS[Math.min(Math.max(week, 1), PHASE0_WEEKS.length) - 1] ?? null;
}
