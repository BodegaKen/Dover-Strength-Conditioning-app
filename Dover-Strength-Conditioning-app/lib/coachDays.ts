// Which dates are "coach-run": scheduled days with nothing for the athlete to log, so the coach's roll call
// is the only record of who was there. Everything else (days with lifts or a sled load) is credited from what
// athletes log themselves, and the roll call is not offered for it.
//
//   Phase 0   : each optional Prep session date (display-only in the app)
//   Phase 3   : any scheduled day whose plan has zero loggable items (Day B, Day C, the Test and Retest
//               speed/shuttle days, the makeup days); Day A (sled load) and Day D (lift) are logged
//
// Derived from the plan data, so a later change to the plan can't leave a stale exception behind.

import { addDaysISO, weekdayOf } from "./calc";
import { PHASE0_WEEKS } from "./phase0";
import { weekRangeISO } from "./schedule";
import { getPeriod } from "./prescription";
import { buildPlanDays, dayProgress } from "./plan";

export type CoachDay = { trackKey: string; week: number; day: string; title: string };

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
