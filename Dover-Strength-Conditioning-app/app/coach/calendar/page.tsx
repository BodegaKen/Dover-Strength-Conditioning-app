import { redirect } from "next/navigation";
import { getCoachPage } from "@/lib/admin";
import { todayISO } from "@/lib/calc";
import NavBar from "@/components/NavBar";
import MonthCalendar from "@/components/MonthCalendar";
import DayPanel from "@/components/DayPanel";
import CalendarPdfCard from "@/components/CalendarPdfCard";

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
        <CalendarPdfCard forCoach />
      </main>
    </div>
  );
}
