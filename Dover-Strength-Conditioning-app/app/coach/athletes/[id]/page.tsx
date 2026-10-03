import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import MonthCalendar from "@/components/MonthCalendar";
import { getCalendarData } from "@/lib/calendar";
import { LIFTS, LIFT_LABEL, computeLoadStats, acwrStatus, addDaysISO, todayISO } from "@/lib/calc";
import type { AthleteRecord, TestEntryRecord, SessionEntryRecord } from "@/lib/types";

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysISO(iso, diff);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

type ActivityRow =
  | { kind: "session"; date: string; type: string; rpe: number; durationMin: number; load: number }
  | { kind: "test"; date: string; lift: string; fiveRM: number; e1RM: number };

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { m?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const coach = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!coach || coach.role !== "COACH") redirect("/dashboard");

  const athlete: AthleteRecord | null = await prisma.user.findUnique({ where: { id: params.id } });

  if (!athlete || athlete.role !== "PLAYER") {
    return (
      <div>
        <NavBar role="COACH" name={coach.name} />
        <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
          <Link href="/coach" className="text-sm text-accent font-semibold">
            &larr; Back to Coach dashboard
          </Link>
          <p className="text-muted">Athlete not found.</p>
        </main>
      </div>
    );
  }

  const tests: TestEntryRecord[] = await prisma.testEntry.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "desc" },
  });
  const sessions: SessionEntryRecord[] = await prisma.sessionEntry.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "desc" },
  });

  const calendarData = await getCalendarData(athlete.id);
  const calMonth = /^\d{4}-\d{2}$/.test(searchParams?.m ?? "") ? (searchParams.m as string) : todayISO().slice(0, 7);

  const latestByLift: Record<string, number> = {};
  for (const t of tests) {
    if (!(t.lift in latestByLift)) latestByLift[t.lift] = t.e1RM;
  }

  const stats = computeLoadStats(sessions.map((s) => ({ date: s.date, load: s.load })));
  const status = acwrStatus(stats);

  // Merge tests + sessions into one activity feed, grouped by week (Mon-Sun),
  // so the coach can see exactly what this athlete did on a given day or
  // across a given week, not just their latest numbers.
  const activity: ActivityRow[] = [
    ...sessions.map(
      (s): ActivityRow => ({
        kind: "session",
        date: s.date,
        type: s.type,
        rpe: s.rpe,
        durationMin: s.durationMin,
        load: s.load,
      })
    ),
    ...tests.map(
      (t): ActivityRow => ({
        kind: "test",
        date: t.date,
        lift: t.lift,
        fiveRM: t.fiveRM,
        e1RM: t.e1RM,
      })
    ),
  ];

  const weekMap = new Map<string, ActivityRow[]>();
  for (const row of activity) {
    const wk = mondayOf(row.date);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(row);
  }

  const currentWeekStart = mondayOf(todayISO());
  const weeks = Array.from(weekMap.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // most recent week first
    .map(([weekStart, rows]) => ({
      weekStart,
      isCurrent: weekStart === currentWeekStart,
      totalLoad: rows.reduce((s, r) => s + (r.kind === "session" ? r.load : 0), 0),
      rows: rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    }));

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <Link href="/coach" className="text-sm text-accent font-semibold">
          &larr; Back to Coach dashboard
        </Link>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl">{athlete.name}</h2>
              <div className="text-sm text-muted mt-1">
                @{athlete.username}
                {athlete.gradYear ? ` · Class of ${athlete.gradYear}` : ""}
                {athlete.position ? ` · ${athlete.position}` : ""}
                {athlete.bodyweight ? ` · ${athlete.bodyweight} lb` : ""}
                {athlete.trainingTrack === "MULTI_SPORT" ? " · Multi-Sport track" : " · Full track"}
                {!athlete.active ? " · Archived" : ""}
              </div>
            </div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${
                status.tone === "good"
                  ? "bg-good-bg text-good"
                  : status.tone === "warning"
                  ? "bg-warning-bg text-warning"
                  : status.tone === "danger"
                  ? "bg-danger-bg text-danger"
                  : "bg-line text-muted"
              }`}
            >
              {status.label}
              {stats.acwr != null ? ` · ACWR ${Math.round(stats.acwr * 100) / 100}` : ""}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <h3 className="text-base mb-3">Current numbers</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LIFTS.map((l) => (
              <div key={l.key} className="rounded-md border border-line px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-muted">{l.label}</div>
                <div className="num text-lg font-semibold">
                  {latestByLift[l.key] != null ? (
                    `${latestByLift[l.key]} lb`
                  ) : (
                    <span className="text-muted text-base">&mdash;</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-base">Training calendar &amp; logged sets</h3>
          <MonthCalendar
            month={calMonth}
            data={calendarData}
            today={todayISO()}
            basePath={`/coach/athletes/${athlete.id}`}
          />
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-base">Weekly log (max tests &amp; session RPE)</h3>
          {weeks.length === 0 && (
            <p className="text-sm text-muted">No tests or sessions logged yet.</p>
          )}
          {weeks.map((w) => (
            <div key={w.weekStart} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide">
                  {w.isCurrent ? "This week" : `Week of ${fmtDate(w.weekStart)}`}
                </h4>
                {w.totalLoad > 0 && (
                  <span className="num text-sm text-muted">Total load {Math.round(w.totalLoad)}</span>
                )}
              </div>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted uppercase text-xs tracking-wide">
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 pr-3">Entry</th>
                      <th className="py-1.5 pr-3">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.rows.map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="py-2 pr-3 whitespace-nowrap num">{fmtDate(r.date)}</td>
                        {r.kind === "session" ? (
                          <>
                            <td className="py-2 pr-3 whitespace-nowrap">{cap(r.type)}</td>
                            <td className="py-2 pr-3 num whitespace-nowrap">
                              RPE {r.rpe} · {r.durationMin} min · load {Math.round(r.load)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 pr-3 whitespace-nowrap">{LIFT_LABEL[r.lift] ?? r.lift} test</td>
                            <td className="py-2 pr-3 num whitespace-nowrap">
                              5RM {r.fiveRM} &rarr; e1RM {r.e1RM}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
