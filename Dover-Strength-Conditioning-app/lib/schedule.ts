// Calendar alignment for the weeks the app can display, taken from the Phase 1
// and Phase 2 Coaching Copies and the Dover Public Schools 2026-27 district
// calendar. Display-only: the coach still sets the active week by hand.

export type WeekInfo = {
  dates: string;
  note?: string; // shown under the week header
  dayNotes?: Record<string, string>; // keyed by plan day name
};

const P1: Record<number, WeekInfo> = {
  1: { dates: "Dec 14-18, 2026", note: "Testing Week. Timed to land before Winter Break (Dec 21 - Jan 3)." },
  2: { dates: "Jan 4-8, 2027", note: "First week back after Winter Break: 3 work sets instead of 4, same prescribed %." },
  3: { dates: "Jan 11-15, 2027" },
  4: {
    dates: "Jan 18-22, 2027",
    note: "MLK Day (Mon Jan 18) is a district closure. It lands on a scheduled volume-dip week (3 x 5), so the missed day needs no special handling.",
    dayNotes: { Monday: "Mon Jan 18 is MLK Day (no school). Day A is skipped this week - don't double up." },
  },
  5: { dates: "Jan 25-29, 2027" },
  6: { dates: "Feb 1-5, 2027", note: "Retest week." },
  7: {
    dates: "Feb 8-12, 2027",
    note: "Staff In-Service, no school for students on Mon Feb 8.",
    dayNotes: { Monday: "No school Mon Feb 8. Do Day A (Back Squat) on Wednesday, Feb 10 this week only." },
  },
  8: {
    dates: "Feb 15-19, 2027",
    note: "Presidents' Day (Mon Feb 15) is a district closure, on a scheduled volume-dip week.",
    dayNotes: { Monday: "Mon Feb 15 is Presidents' Day (no school). Day A is skipped this week - don't double up." },
  },
  9: { dates: "Feb 22-26, 2027", note: "Closes Phase 1. These e1RMs carry into Phase 2." },
};

const P2: Record<number, WeekInfo> = {
  1: { dates: "Mar 1-5, 2027", note: "Testing Week (adds Vertical Jump on Tuesday, which isn't tracked in this app)." },
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

export function weekInfo(trackKey: string, week: number): WeekInfo | null {
  if (trackKey === "phase1") return P1[week] ?? null;
  if (trackKey === "phase2") return P2[week] ?? null;
  return null;
}
