// The printable lifting calendar (DPS 2026-27 district calendar with the lifting phases outlined), in two copies:
//   coachHref  : full version, in public/coach/ (the proxy serves /coach/* to coaches only)
//   playerHref : athlete version, in public/files/ (any signed-in user). Same pages, but page 3 stops after the
//                phase key: the coach-only sections ("What isn't shown, and why", "Changed Oct 28, 2026",
//                "Fixed in the source documents") are removed.
// prepDatesCurrent: false shows coaches a warning that the Pre-Testing Prep dates in the PDF are out of date.
// playerVisible: the athlete Calendar page shows the PDF card only when this is true.
export const CALENDAR_PDF = {
  coachHref: "/coach/lifting-calendar-2026-27.pdf",
  playerHref: "/files/lifting-calendar-2026-27-athletes.pdf",
  updated: "Nov 21, 2026",
  prepDatesCurrent: true,
  playerVisible: true,
};
