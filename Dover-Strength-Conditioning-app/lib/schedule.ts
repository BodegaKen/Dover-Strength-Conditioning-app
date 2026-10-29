// Calendar alignment for the weeks the app can display, taken from the Phase 1
// and Phase 2 Coaching Copies and the Dover Public Schools 2026-27 district
// calendar. Display-only: the coach still sets the active week by hand.

import { phase0Week } from "./phase0";

export type WeekInfo = {
  dates: string;
  note?: string; // shown under the week header
  dayNotes?: Record<string, string>; // keyed by plan day name
};

const P1: Record<number, WeekInfo> = {
  1: {
    dates: "Dec 14-18, 2026",
    note: "Testing Week: Mon squat, Tue bench + pull-up, Wed none, Thu deadlift, Fri overhead press + make-ups. Timed to land before Winter Break (district closure Dec 24 - Jan 1; Dec 21-23 are intentionally left unprogrammed). Fewer than 4 Prep sessions attended means no heavy 5RM this week.",
  },
  2: { dates: "Jan 4-8, 2027", note: "First week back after Winter Break: 3 work sets instead of 4, same prescribed %." },
  3: { dates: "Jan 11-15, 2027" },
  4: {
    dates: "Jan 18-22, 2027",
    note: "MLK Day (Mon Jan 18) is a district closure and a scheduled 3-set week. No session is dropped: Day A (Back Squat) moves to Tuesday, Jan 19 and Day B (Hinge) to Wednesday, Jan 20. Day C and D stay Thursday and Friday.",
    dayNotes: {
      Monday: "No school Mon Jan 18 (MLK Day). Do this day (Day A, Back Squat) on Tuesday, Jan 19.",
      Tuesday: "Do this day (Day B, Hinge) on Wednesday, Jan 20, after Tuesday's squat.",
    },
  },
  5: { dates: "Jan 25-29, 2027" },
  6: { dates: "Feb 1-5, 2027", note: "Retest week." },
  7: {
    dates: "Feb 8-12, 2027",
    note: "Staff In-Service, no school for students on Mon Feb 8. Day A (Back Squat) moves to Tuesday, Feb 9 and Day B (Hinge) to Wednesday, Feb 10. Day C and D stay Thursday and Friday.",
    dayNotes: {
      Monday: "No school Mon Feb 8. Do this day (Day A, Back Squat) on Tuesday, Feb 9.",
      Tuesday: "Do this day (Day B, Hinge) on Wednesday, Feb 10, after Tuesday's squat.",
    },
  },
  8: {
    dates: "Feb 15-19, 2027",
    note: "Presidents' Day (Mon Feb 15) is a district closure and a scheduled 3-set week. Day A (Back Squat) moves to Tuesday, Feb 16 and Day B (Hinge) to Wednesday, Feb 17. Day C and D stay Thursday and Friday.",
    dayNotes: {
      Monday: "No school Mon Feb 15 (Presidents' Day). Do this day (Day A, Back Squat) on Tuesday, Feb 16.",
      Tuesday: "Do this day (Day B, Hinge) on Wednesday, Feb 17, after Tuesday's squat.",
    },
  },
  9: { dates: "Feb 22-26, 2027", note: "Closes Phase 1. These e1RMs carry into Phase 2." },
};

const P2: Record<number, WeekInfo> = {
  1: { dates: "Mar 1-5, 2027", note: "Testing Week (adds Vertical Jump on Monday, before the squat; it is not tracked in this app)." },
  2: { dates: "Mar 8-12, 2027" },
  3: { dates: "Mar 15-19, 2027" },
  4: {
    dates: "Mar 22-26, 2027",
    note: "Spring Break starts Fri Mar 26 (Mar 29 - Apr 2 is a full break).",
    dayNotes: {
      Thursday: "Thu Mar 25 is a contingent emergency day - closed by default. Plan on training; if it's closed, skip it.",
      Friday: "Fri Mar 26 is the first Spring Break day (no school). Day D is skipped - it's absorbed into the break.",
    },
  },
  5: {
    dates: "Apr 5-9, 2027",
    note: "First week back from Spring Break: Strength Lane runs 78% x 3 (not 84% x 4). The Power Lane stays as written.",
    dayNotes: {
      Friday: "Fri Apr 9 is a staff in-service, single-session day for students. Day D still runs - your coach will set the time (after school or a shortened session).",
    },
  },
  6: { dates: "Apr 12-16, 2027" },
  7: { dates: "Apr 19-23, 2027", note: "Retest week." },
  8: { dates: "Apr 26-30, 2027" },
  9: { dates: "May 3-7, 2027" },
  10: { dates: "May 10-14, 2027" },
  11: {
    dates: "May 17-21, 2027",
    note: "Closes Phase 2.",
    dayNotes: {
      Monday: "Mon May 17 is a contingent emergency day - closed by default. Plan on training; if it's closed, skip it.",
    },
  },
};

// Phase 3 (Early Summer) 2027 dates: Test Week Mon-Thu Jun 21-24, four training weeks, Retest Week
// Mon-Thu Jul 26-29. Dates only; the field days are run by the coaches.
const P3: Record<number, WeekInfo> = {
  1: { dates: "Jun 21-24, 2027" },
  2: { dates: "Jun 28-Jul 1, 2027" },
  3: { dates: "Jul 5-8, 2027" },
  4: { dates: "Jul 12-15, 2027" },
  5: { dates: "Jul 19-22, 2027" },
  6: { dates: "Jul 26-29, 2027" },
};

export function weekInfo(trackKey: string, week: number): WeekInfo | null {
  if (trackKey === "phase0") {
    const w = phase0Week(week);
    return w ? { dates: w.dates, note: w.note } : null;
  }
  if (trackKey === "phase1") return P1[week] ?? null;
  if (trackKey === "phase2") return P2[week] ?? null;
  if (trackKey === "phase3") return P3[week] ?? null;
  return null;
}

const MONTH_NUM: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

// ISO start/end dates of a week, parsed from its display string ("Jan 11-15, 2027", "Jun 28-Jul 1, 2027",
// "Oct 26 - Nov 1, 2026"). Null when the week has no dates (e.g. in-season weeks).
export function weekRangeISO(trackKey: string, week: number): { start: string; end: string } | null {
  const info = weekInfo(trackKey, week);
  if (!info) return null;
  const m = info.dates.match(/^([A-Z][a-z]{2}) (\d{1,2})\s*-\s*(?:([A-Z][a-z]{2}) )?(\d{1,2}), (\d{4})$/);
  if (!m) return null;
  const sm = MONTH_NUM[m[1]];
  const em = m[3] ? MONTH_NUM[m[3]] : sm;
  if (!sm || !em) return null;
  const year = Number(m[5]);
  const startYear = sm > em ? year - 1 : year;
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: `${startYear}-${p(sm)}-${p(Number(m[2]))}`, end: `${year}-${p(em)}-${p(Number(m[4]))}` };
}
