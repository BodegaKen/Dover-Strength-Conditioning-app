import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { todayISO, addDaysISO, weekdayOf, LIFTS } from "@/lib/calc";
import { buildCalendarData } from "@/lib/calendar";
import { getTrack, getPeriod } from "@/lib/prescription";
import { buildPlanDays, dayProgress, isTestPeriod, type TrainingTrack, type PullupMode } from "@/lib/plan";
import { weekInfo, weekRangeISO } from "@/lib/schedule";
import { PHASE0_WEEKS } from "@/lib/phase0";
import { validDate } from "@/lib/validate";
import NavBar from "@/components/NavBar";
import AttendanceRoster, { type RosterRow } from "./AttendanceRoster";

// Coach attendance: pick a day, mark the roster present or absent, and see for each athlete whether
// they also completed the day in the app. Credit = coach-marked present OR completed in the app (a coach's
// Absent mark overrides). The month tally measures credited days against counted days, not an assumed schedule.
export default async function AttendancePage({ searchParams }: { searchParams: { d?: string; t?: string; w?: string } }) {
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
    select: { id: true, name: true, position: true, pullupTrack: true, trainingTrack: true },
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

  // ---- Weekly training log: each athlete's scheduled sessions for a week against what they did.
  // Loggable weeks: the plan days the athlete is scheduled for, judged from their own logging (Done = every
  // required item, Partial = some logged). Test weeks: each lift due, counted when a test is entered inside the
  // week. Phase 0 sessions are display-only, so there a coach's Present mark on the session date is what counts.
  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  const curTrack = state?.trackKey ?? "phase1";
  const curWeek = state?.week ?? 1;
  const logTrack = getTrack(searchParams.t ?? "") ?? getTrack(curTrack);
  const logKey = logTrack?.key ?? curTrack;
  const maxWeek = logTrack?.periods.length ?? 1;
  let logWeek = Number(searchParams.w);
  if (!Number.isInteger(logWeek) || logWeek < 1) logWeek = logKey === curTrack ? curWeek : 1;
  logWeek = Math.min(logWeek, maxWeek);
  const logPeriod = getPeriod(logKey, logWeek);
  const logInfo = weekInfo(logKey, logWeek);

  type Chip = { label: string; title: string; state: "done" | "partial" | "none" };
  const MONTH: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const pad = (n: number) => String(n).padStart(2, "0");

  let allMarks: { athleteId: string; date: string; present: boolean }[] = [];
  try {
    allMarks = await prisma.attendance.findMany({ where: { athleteId: { in: ids } }, select: { athleteId: true, date: true, present: true } });
  } catch {
    allMarks = [];
  }
  const markKey = new Map<string, boolean>();
  for (const m of allMarks) markKey.set(`${m.athleteId}|${m.date}`, m.present);

  const trackRows = logKey === "phase0" ? [] : await prisma.setLog.findMany({ where: { athleteId: { in: ids }, trackKey: logKey, week: { lte: logWeek } } });
  const rowsByAthleteWeek = new Map<string, any[]>();
  for (const r of trackRows) {
    const k = `${r.athleteId}|${r.week}`;
    (rowsByAthleteWeek.get(k) ?? rowsByAthleteWeek.set(k, []).get(k)!).push(r);
  }

  function chipsFor(a: (typeof athletes)[number], i: number): Chip[] {
    if (logKey === "phase0") {
      const w = PHASE0_WEEKS[i - 1];
      if (!w) return [];
      const year = w.dates.match(/(\d{4})$/)?.[1];
      return w.days.map((d) => {
        const m = d.day.match(/^(\w+),\s+([A-Z][a-z]{2}) (\d{1,2})$/);
        const iso = year && m && MONTH[m[2]] ? `${year}-${pad(MONTH[m[2]])}-${pad(Number(m[3]))}` : null;
        const mark = iso ? markKey.get(`${a.id}|${iso}`) : undefined;
        return { label: m ? m[1].slice(0, 3) : d.day, title: d.day + (mark === false ? " (marked absent)" : mark === true ? " (marked present)" : ""), state: mark === true ? "done" : "none" } as Chip;
      });
    }
    const out: Chip[] = [];
    const period = getPeriod(logKey, i);
    const rng = weekRangeISO(logKey, i);
    if (isTestPeriod(period) && rng) {
      const end = addDaysISO(rng.end, 2);
      for (const l of LIFTS) {
        const mode = (period?.lifts?.[l.key] as any)?.mode;
        if (mode !== "test" && mode !== "retest") continue;
        if (l.key === "pullup" && a.pullupTrack !== "WEIGHTED") continue;
        const got = (byAthleteTests.get(a.id) ?? []).some((t: any) => t.lift === l.key && t.date >= rng.start && t.date <= end);
        out.push({ label: l.label, title: `${l.label} test`, state: got ? "done" : "none" });
      }
    }
    let days: ReturnType<typeof buildPlanDays> = [];
    try {
      days = buildPlanDays({ trackKey: logKey, period, variant: (a.trainingTrack ?? "FULL") as TrainingTrack, pullupMode: (a.pullupTrack ?? "BODYWEIGHT") as PullupMode, position: a.position }).filter((d) => !d.isTest);
    } catch {
      days = [];
    }
    const mine = rowsByAthleteWeek.get(`${a.id}|${i}`) ?? [];
    for (const d of days) {
      const prog = dayProgress(d, mine.filter((r: any) => r.planDay === d.day));
      out.push({
        label: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(d.day) ? d.day.slice(0, 3) : d.day,
        title: d.day,
        state: prog.complete ? "done" : prog.started ? "partial" : "none",
      });
    }
    return out;
  }

  const logRows = athletes.map((a) => {
    const thisWeek = chipsFor(a, logWeek);
    let sched = 0;
    let done = 0;
    for (let i = 1; i <= logWeek; i++) {
      const cs = i === logWeek ? thisWeek : chipsFor(a, i);
      sched += cs.length;
      done += cs.filter((c) => c.state === "done").length;
    }
    return { id: a.id, name: a.name, thisWeek, weekDone: thisWeek.filter((c) => c.state === "done").length, sched, done };
  });
  const logHref = (w: number) => `/coach/attendance?t=${logKey}&w=${w}`;

  const label = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const monthLabel = new Date(monthStart + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base">
              Training log: {logTrack?.name ?? logKey} &middot; {logPeriod?.label ?? `Week ${logWeek}`}
              {logInfo ? ` (${logInfo.dates})` : ""}
            </h3>
            <div className="flex items-center gap-2">
              {logWeek > 1 && <Link href={logHref(logWeek - 1)} className="text-sm border border-line rounded-md px-3 py-1.5">&larr; Prev week</Link>}
              <Link href="/coach/attendance" className="text-sm border border-line rounded-md px-3 py-1.5">This week</Link>
              {logWeek < maxWeek && <Link href={logHref(logWeek + 1)} className="text-sm border border-line rounded-md px-3 py-1.5">Next week &rarr;</Link>}
            </div>
          </div>
          <p className="text-sm text-muted my-2">
            Each athlete&rsquo;s scheduled sessions this week, from what they log in the app: <span className="text-good font-semibold">Done</span> = every
            item logged, <span className="text-warning font-semibold">Partial</span> = some logged. &ldquo;Phase to date&rdquo; counts every scheduled
            session from Week 1 through the week shown. Phase 0 sessions can&rsquo;t be logged in the app, so there a coach&rsquo;s Present mark is what counts.
            {logKey === "phase3" ? " Phase 3's field days (sprints, sled, plyometrics) aren't logged in the app yet, so only Wednesday's lift is counted." : ""}
          </p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted uppercase text-xs tracking-wide">
                  <th className="py-1.5 pr-3">Athlete</th>
                  <th className="py-1.5 pr-3">This week</th>
                  <th className="py-1.5 pr-3">Done</th>
                  <th className="py-1.5 pr-3">Phase to date</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                      <Link href={`/coach/athletes/${r.id}`} className="hover:text-accent hover:underline">{r.name}</Link>
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {r.thisWeek.length === 0 && <span className="text-muted text-xs">Nothing scheduled</span>}
                        {r.thisWeek.map((c, i) => (
                          <span
                            key={i}
                            title={c.title}
                            className={`text-xs rounded-full px-2 py-0.5 border ${
                              c.state === "done" ? "border-good bg-good-bg text-good" : c.state === "partial" ? "border-warning bg-warning-bg text-warning" : "border-line text-muted"
                            }`}
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 num whitespace-nowrap">{r.thisWeek.length ? `${r.weekDone} of ${r.thisWeek.length}` : "\u2014"}</td>
                    <td className="py-1.5 pr-3 num whitespace-nowrap">
                      {r.sched ? `${r.done} of ${r.sched} (${Math.round((r.done / r.sched) * 100)}%)` : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Daily roll call</h2>
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
          <h3 className="text-base mb-1">{monthLabel} roll-call tally</h3>
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
