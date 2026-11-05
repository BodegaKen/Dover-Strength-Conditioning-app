import { redirect } from "next/navigation";
import { getCoachPage } from "@/lib/admin";
import { todayISO } from "@/lib/calc";
import NavBar from "@/components/NavBar";
import MonthCalendar from "@/components/MonthCalendar";
import DayPanel from "@/components/DayPanel";

// Any coach: the lifting calendar. Tap a day to see what is scheduled that day. Read-only; athletes log
// on their own pages.
export default async function CoachCalendarPage({ searchParams: searchParamsP }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const searchParams = await searchParamsP;
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");

  const today = todayISO();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? (searchParams.d as string) : today;
  const month = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? (searchParams.m as string) : selected.slice(0, 7);

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <MonthCalendar month={month} data={{}} today={today} basePath="/coach/calendar" selected={selected} showLog={false}>
          <DayPanel iso={selected} user={null} />
        </MonthCalendar>
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Printable calendar</h2>
          <p className="text-sm text-muted mb-3">
            The Dover Public Schools 2026-27 district calendar with the lifting phases outlined (Phase 0 through Phase 3 and the
            Phase 2-3 Bridge), plus a key page. Phase 4 and the blackout week are not shaded because their dates are not set yet.
            Last updated Nov 4, 2026.
          </p>
          <a
            href="/coach/lifting-calendar-2026-27.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5"
          >
            Open calendar (PDF)
          </a>
        </div>
      </main>
    </div>
  );
}
