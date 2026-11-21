// Roll call and "coach-run" days.
//
// Roll call is offered on every scheduled session date in data/phase-calendar.json (Pre-Testing Prep, Phases
// 1-3, the Phase 2-3 Bridge), so a coach can mark athletes who have no phone, lifting days included. A
// Present mark credits that day; an Absent mark overrides anything logged. Phase 4 and the Camp Bridge have
// no fixed dates yet, so they have no roll call.
//
// "Coach-run" days are the subset with nothing for the athlete to log, where the roll call is the only record:
//   Phase 0   : each optional Prep session date (display-only in the app)
//   Phase 3   : any scheduled day whose plan has zero loggable items (Day B, Day C, the Test and Retest
//               speed/shuttle days, the makeup days); Day A (sled load) and Day D (lift) are logged
// Derived from the plan data, so a later change to the plan can't leave a stale exception behind.

import { addDaysISO, weekdayOf } from "./calc";
import { PHASE0_WEEKS } from "./phase0";
import { weekRangeISO, planDayForDate } from "./schedule";
import { getPeriod } from "./prescription";
import { buildPlanDays, dayProgress } from "./plan";
import phaseCal from "../data/phase-calendar.json";

export type CoachDay = { trackKey: string; week: number; day: string; title: string };

const CAL_DAYS = phaseCal.days as unknown as Record<string, [string, string]>;
const CAL_PHASES = phaseCal.phases as unknown as Record<string, { label: string }>;
const KIND_LABEL: Record<string, string> = { s: "session", t: "test day", o: "optional session", c: "session if school is open" };

export type RollCallDay = { title: string; coachRun: boolean };

// A scheduled session date (roll call allowed), or null.
export function rollCallDayFor(date: string): RollCallDay | null {
  const entry = CAL_DAYS[date];
  if (!entry) return null;
  const coach = coachRunDayFor(date);
  const title = coach?.title ?? `${CAL_PHASES[entry[0]]?.label ?? entry[0]} ${KIND_LABEL[entry[1]] ?? "session"}`;
  return { title, coachRun: coach != null };
}

// Nearest scheduled session date strictly after (dir = 1) or before (dir = -1) the given date.
export function nextRollCallDate(date: string, dir: 1 | -1): string | null {
  const all = Object.keys(CAL_DAYS).sort();
  if (dir === 1) return all.find((d) => d > date) ?? null;
  for (let i = all.length - 1; i >= 0; i--) if (all[i] < date) return all[i];
  return null;
}

// The date a weekday-named plan day actually runs in a week, following closure moves (MLK Day etc. move
// Monday's Day A to Tuesday). Null for days not named for a weekday (Multi-Sport "Track Day 1") or not run.
export function dateOfPlanDay(trackKey: string, week: number, planDay: string): string | null {
  const rng = weekRangeISO(trackKey, week);
  if (!rng) return null;
  for (let i = 0; i < 7; i++) {
    const d = addDaysISO(rng.start, i);
    if (d > rng.end) break;
    if (planDayForDate(d, weekdayOf(d)) === planDay) return d;
  }
  return null;
}

const MONTH: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

// "Tuesday, Nov 10" + the week's year -> "2026-11-10"
export function phase0DayISO(weekDates: string, dayLabel: string): string | null {
  const year = weekDates.match(/(\d{4})$/)?.[1];
  const m = dayLabel.match(/^(\w+),\s+([A-Z][a-z]{2}) (\d{1,2})$/);
  return year && m && MONTH[m[2]] ? `${year}-${pad(MONTH[m[2]])}-${pad(Number(m[3]))}` : null;
}

export function coachRunDayFor(date: string): CoachDay | null {
  for (let i = 0; i < PHASE0_WEEKS.length; i++) {
    const w = PHASE0_WEEKS[i];
    for (const d of w.days) {
      if (phase0DayISO(w.dates, d.day) === date) return { trackKey: "phase0", week: i + 1, day: d.day, title: `Phase 0 - ${w.label}` };
    }
  }
  const weekday = weekdayOf(date);
  for (let i = 1; i <= 6; i++) {
    const rng = weekRangeISO("phase3", i);
    if (!rng || date < rng.start || date > rng.end) continue;
    const period = getPeriod("phase3", i);
    if (!period) return null;
    const days = buildPlanDays({ trackKey: "phase3", period, variant: "FULL", pullupMode: "BODYWEIGHT", position: null });
    const day = days.find((d) => d.day === weekday);
    if (day && day.exercises.length > 0 && dayProgress(day, []).total === 0) {
      return { trackKey: "phase3", week: i, day: weekday, title: `Phase 3 - ${period.label}${day.title ? ` - ${day.title}` : ""}` };
    }
    return null;
  }
  return null;
}

// Nearest coach-run date strictly after (dir = 1) or before (dir = -1) the given date, scanning up to ~16 months.
export function nextCoachRunDate(date: string, dir: 1 | -1): string | null {
  let d = date;
  for (let i = 0; i < 480; i++) {
    d = addDaysISO(d, dir);
    if (coachRunDayFor(d)) return d;
  }
  return null;
}

// ISO date of a weekday inside a week of a track, or null.
export function dateOfWeekday(trackKey: string, week: number, weekday: string): string | null {
  const rng = weekRangeISO(trackKey, week);
  if (!rng) return null;
  for (let i = 0; i < 7; i++) {
    const d = addDaysISO(rng.start, i);
    if (d > rng.end) break;
    if (weekdayOf(d) === weekday) return d;
  }
  return null;
}
