import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/calc";
import { getCalendarData } from "@/lib/calendar";
import NavBar from "@/components/NavBar";
import MonthCalendar from "@/components/MonthCalendar";

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");
  if (user.role === "COACH") redirect("/coach");

  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? (searchParams.m as string) : today.slice(0, 7);
  const data = await getCalendarData(user.id);

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5">
        <MonthCalendar month={month} data={data} today={today} basePath="/calendar" />
      </main>
    </div>
  );
}
