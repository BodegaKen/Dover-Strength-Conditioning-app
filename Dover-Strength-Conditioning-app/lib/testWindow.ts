// When an ATHLETE may enter his own test max: only while the team's active period is a Testing or
// retest week, and only for a date inside that week's own dates (from lib/schedule.ts). Without the
// date range, a team state left on a test week (for example through Winter Break) would let a player
// enter a new "test" every calendar week. Coaches are never limited by this: they enter make-ups and
// corrections on any date.

import { getPeriod } from "./prescription";
import { isTestPeriod } from "./plan";
import { weekRangeISO, weekInfo } from "./schedule";
import { mondayOf } from "./calc";

export type SelfTestWindow =
  | { open: false; reason: "not-test-week" }
  | { open: true; start: string | null; end: string | null; label: string | null };

export function selfTestWindow(trackKey: string, week: number): SelfTestWindow {
  if (!isTestPeriod(getPeriod(trackKey, week))) return { open: false, reason: "not-test-week" };
  const rng = weekRangeISO(trackKey, week);
  return { open: true, start: rng?.start ?? null, end: rng?.end ?? null, label: weekInfo(trackKey, week)?.dates ?? null };
}

// Null when the date is allowed for a player's own entry, else the message to show.
export function selfTestDateProblem(win: SelfTestWindow, date: string, today: string): string | null {
  if (!win.open) return "Max tests are entered during Testing Week and retest weeks. Ask a coach to enter a make-up test.";
  if (date > today) return "That date is in the future. Use the day you tested.";
  if (win.start && win.end) {
    if (date < win.start || date > win.end) {
      return `Use a date inside this test week (${win.label ?? `${win.start} to ${win.end}`}). Ask a coach to enter a make-up or an older test.`;
    }
    return null;
  }
  // A test period with no dated week on file: fall back to the current calendar week.
  if (mondayOf(date) !== mondayOf(today)) return "Use a date from this week. Ask a coach to enter an older test.";
  return null;
}

// Whether the player's test form should be offered today at all.
export function selfTestOpenOn(win: SelfTestWindow, today: string): boolean {
  if (!win.open) return false;
  if (win.start && win.end) return today >= win.start && today <= win.end;
  return true;
}
