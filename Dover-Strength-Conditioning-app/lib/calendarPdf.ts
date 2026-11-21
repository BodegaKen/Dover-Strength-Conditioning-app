// The printable lifting calendar (DPS 2026-27 district calendar with the lifting phases outlined). It lives
// in public/files/, which the proxy serves only to signed-in users (coaches and athletes).
//
// playerVisible: the athlete Calendar page shows the PDF card only when this is true. It is held false while
// the PDF still shows the old Pre-Testing Prep dates (Nov 10 - Dec 10); set it true once the PDF has been
// redrawn with Prep on Mon/Tue/Thu/Fri, Nov 30 - Dec 11, and replaced in public/files/.
export const CALENDAR_PDF = {
  href: "/files/lifting-calendar-2026-27.pdf",
  updated: "Nov 11, 2026",
  prepDatesCurrent: false,
  playerVisible: false,
};
