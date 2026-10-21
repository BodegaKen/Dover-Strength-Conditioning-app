import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { todayISO, addDaysISO, weekdayOf } from "@/lib/calc";
import { buildCalendarData } from "@/lib/calendar";
import { validDate } from "@/lib/validate";
import NavBar from "@/components/NavBar";
import AttendanceRoster, { type RosterRow } from "./AttendanceRoster";

// Coach attendance: pick a day, mark the roster present or absent, and see for each athlete whether
// they also completed the day in the app. Credit = coach-marked present OR completed in the app (a coach's
// Absent mark overrides). The month tally measures credited days against counted days, not an assumed schedule.
export default async function AttendancePage({ searchParams }: { searchParams: { d?: string } }) {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");

  const today = todayISO();
  const date = searchParams.d && validDate(searchParams.d) ? searchParams.d : today;
  const month = date.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`; // string compare against yyyy-mm-dd; days past the real end don't exist

  const athletes = await prisma.user.findMany({
    where: { role: "PLAYER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, position: true, pullupTrack: true },
  });
  const ids = athletes.map((a) => a.id);

  let marks: { athleteId: string; date: string; present: boolean }[] | null = null;
  try {
    marks = await prisma.attendance.findMany({
      where: { athleteId: { in: ids }, date: { gte: monthStart, lte: monthEnd } },
      select: { athleteId: true, date: true, present: true },
    });
  } catch {
    marks = null; // table doesn't exist until `prisma db push` has been run
  }

  // Auto-completion from the athletes' own logging: all of the month's set logs and tests in two queries.
  const [setRows, tests] = await Promise.all([
    prisma.setLog.findMany({ where: { athleteId: { in: ids }, date: { gte: monthStart, lte: monthEnd } } }),
    prisma.testEntry.findMany({ where: { athleteId: { in: ids } } }),
  ]);
  const byAthleteRows = new Map<string, any[]>();
  for (const r of setRows) (byAthleteRows.get(r.athleteId) ?? byAthleteRows.set(r.athleteId, []).get(r.athleteId)!).push(r);
  const byAthleteTests = new Map<string, any[]>();
  for (const t of tests) (byAthleteTests.get(t.athleteId) ?? byAthleteTests.set(t.athleteId, []).get(t.athleteId)!).push(t);

  const appStateByDay = new Map<string, Map<string, "complete" | "partial">>(); // date -> athleteId -> state
  for (const a of athletes) {
    const cal = buildCalendarData(a, byAthleteRows.get(a.id) ?? [], byAthleteTests.get(a.id) ?? []);
    for (const [d, entries] of Object.entries(cal)) {
      if (d < monthStart || d > monthEnd) continue;
      const m = appStateByDay.get(d) ?? new Map<string, "complete" | "partial">();
      appStateByDay.set(d, m);
      m.set(a.id, entries.some((e) => e.complete) ? "complete" : "partial");
    }
  }

  const dayMarks = new Map<string, boolean>();
  for (const m of marks ?? []) if (m.date === date) dayMarks.set(m.athleteId, m.present);
  const rows: RosterRow[] = athletes.map((a) => ({
    id: a.id,
    name: a.name,
    position: a.position,
    present: dayMarks.has(a.id) ? (dayMarks.get(a.id) as boolean) : null,
    appState: appStateByDay.get(date)?.get(a.id) ?? "none",
  }));

  // Month tally. Credit rule: a coach's Absent mark always stands; otherwise a day counts for an athlete
  // if a coach marked them present OR they completed the day in the app (self-reported, e.g. lifting at
  // another gym). Credited days are measured against "counted days": days a coach marked anyone, or
  // any athlete completed the day.
  const markByAthleteDay = new Map<string, boolean>(); // `${athleteId}|${date}` -> present
  for (const m of marks ?? []) markByAthleteDay.set(`${m.athleteId}|${m.date}`, m.present);
  const countedSet = new Set<string>((marks ?? []).map((m) => m.date));
  for (const [d, m] of Array.from(appStateByDay.entries())) {
    for (const st of Array.from(m.values())) if (st === "complete") countedSet.add(d);
  }
  const rollCallDays = Array.from(countedSet).sort();
  const tally = athletes.map((a) => {
    let creditedDays = 0;
    let roomDays = 0;
    let appOnlyDays = 0;
    for (const d of rollCallDays) {
      const mark = markByAthleteDay.get(`${a.id}|${d}`);
      const done = appStateByDay.get(d)?.get(a.id) === "complete";
      if (mark === false) continue;
      if (mark === true) { creditedDays++; roomDays++; }
      else if (done) { creditedDays++; appOnlyDays++; }
    }
    return { id: a.id, name: a.name, creditedDays, roomDays, appOnlyDays };
  });

  const label = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const monthLabel = new Date(monthStart + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Attendance</h2>
            <div className="flex items-center gap-2">
              <Link href={`/coach/attendance?d=${addDaysISO(date, -1)}`} className="text-sm border border-line rounded-md px-3 py-1.5">&larr; Prev day</Link>
              <Link href="/coach/attendance" className="text-sm border border-line rounded-md px-3 py-1.5">Today</Link>
              <Link href={`/coach/attendance?d=${addDaysISO(date, 1)}`} className="text-sm border border-line rounded-md px-3 py-1.5">Next day &rarr;</Link>
            </div>
          </div>
          <div className="font-semibold">{label}</div>
          {marks == null && (
            <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">
              The attendance table doesn&rsquo;t exist yet. Run `npx prisma db push` once, then reload.
            </div>
          )}
          {weekdayOf(date) === "Saturday" || weekdayOf(date) === "Sunday" ? (
            <div className="text-xs text-muted">That is a weekend day; roll call still works if you held a session.</div>
          ) : null}
          <AttendanceRoster date={date} rows={rows} />
          <p className="text-xs text-muted">
            An athlete is credited as present if you tap Present <em>or</em> they finish the day in the app (every required item), so
            athletes training at another gym still get credit. App completion is self-reported and can be entered after the fact, so you
            can tap Absent to override it. Out-of-season sessions are voluntary under the program&rsquo;s own rules; confirm with the AD that
            keeping attendance for them is fine.
          </p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <h3 className="text-base mb-1">{monthLabel} tally</h3>
          <p className="text-sm text-muted mb-3">
            {rollCallDays.length} counted day{rollCallDays.length === 1 ? "" : "s"} this month (days a coach marked anyone, or any athlete
            finished the day in the app). &ldquo;Credited&rdquo; = marked present by a coach, or finished in the app.
          </p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted uppercase text-xs tracking-wide">
                  <th className="py-1.5 pr-3">Athlete</th>
                  <th className="py-1.5 pr-3">Credited</th>
                  <th className="py-1.5 pr-3">In the room</th>
                  <th className="py-1.5 pr-3">App only</th>
                </tr>
              </thead>
              <tbody>
                {tally.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                      <Link href={`/coach/athletes/${t.id}`} className="hover:text-accent hover:underline">{t.name}</Link>
                    </td>
                    <td className="py-1.5 pr-3 num whitespace-nowrap">{t.creditedDays} of {rollCallDays.length}</td>
                    <td className="py-1.5 pr-3 num whitespace-nowrap">{t.roomDays}</td>
                    <td className="py-1.5 pr-3 num whitespace-nowrap">{t.appOnlyDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href={`/coach/attendance?d=${addDaysISO(monthStart, -1)}`} className="text-accent font-semibold">&larr; Previous month</Link>
            <Link href={`/coach/attendance?d=${addDaysISO(`${month}-28`, 7).slice(0, 7)}-01`} className="text-accent font-semibold">Next month &rarr;</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
