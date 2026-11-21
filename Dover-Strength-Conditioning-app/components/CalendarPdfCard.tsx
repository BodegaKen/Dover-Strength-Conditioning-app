import { CALENDAR_PDF } from "@/lib/calendarPdf";

// "Printable calendar" card, shown under the month grid on the coach and athlete Calendar pages.
export default function CalendarPdfCard({ forCoach }: { forCoach: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h2 className="text-lg mb-1">Printable calendar</h2>
      <p className="text-sm text-muted mb-3">
        The Dover Public Schools 2026-27 district calendar with the lifting phases outlined (Phase 0 through Phase 3 and the Phase 2-3 Bridge),
        plus a key page. Phase 4 and the blackout week are not shaded because their dates are not set yet. Last updated {CALENDAR_PDF.updated}.
      </p>
      {forCoach && !CALENDAR_PDF.prepDatesCurrent && (
        <p className="text-sm rounded-md border border-warning bg-warning-bg px-3 py-2 mb-3">
          This PDF still shows the old Pre-Testing Prep dates (Tue/Thu, Nov 10 - Dec 10). Prep now runs Mon, Tue, Thu and Fri, Nov 30 - Dec 11; the
          month grid above is current. Athletes do not see this card until the PDF is redrawn.
        </p>
      )}
      <a
        href={CALENDAR_PDF.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5"
      >
        Open calendar (PDF)
      </a>
    </div>
  );
}
