import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllTracks } from "@/lib/prescription";
import { LIFTS, computeLoadStats, acwrStatus } from "@/lib/calc";
import type { AthleteRecord, TestEntryRecord, SessionEntryRecord } from "@/lib/types";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import RosterAdmin from "./RosterAdmin";
import PhaseWeekSetter from "./PhaseWeekSetter";
import ExportCsvButton from "./ExportCsvButton";

export default async function CoachPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const coach = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!coach || coach.role !== "COACH") redirect("/dashboard");

  const athletes: AthleteRecord[] = await prisma.user.findMany({
    where: { role: "PLAYER" },
    orderBy: { name: "asc" },
  });
  const tests: TestEntryRecord[] = await prisma.testEntry.findMany();
  const sessions: SessionEntryRecord[] = await prisma.sessionEntry.findMany();
  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  const tracks = getAllTracks().map((t) => ({
    key: t.key,
    name: t.name,
    periods: t.periods.map((p) => ({ index: p.index, label: p.label })),
  }));

  const latestByAthleteLift: Record<string, Record<string, number>> = {};
  for (const t of tests.sort((a: TestEntryRecord, b: TestEntryRecord) => (a.date < b.date ? 1 : -1))) {
    latestByAthleteLift[t.athleteId] ??= {};
    if (!(t.lift in latestByAthleteLift[t.athleteId])) latestByAthleteLift[t.athleteId][t.lift] = t.e1RM;
  }

  const active = athletes.filter((a: AthleteRecord) => a.active);
  const rows = active.map((a: AthleteRecord) => {
    const mySessions = sessions
      .filter((s: SessionEntryRecord) => s.athleteId === a.id)
      .map((s: SessionEntryRecord) => ({ date: s.date, load: s.load }));
    const stats = computeLoadStats(mySessions);
    const status = acwrStatus(stats);
    const lifts = latestByAthleteLift[a.id] ?? {};
    return { athlete: a, lifts, stats, status };
  });

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <PhaseWeekSetter
          tracks={tracks}
          current={{ trackKey: state?.trackKey ?? tracks[0].key, week: state?.week ?? 1 }}
        />

        <RosterAdmin
          athletes={athletes.map((a) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            position: a.position,
            gradYear: a.gradYear,
            bodyweight: a.bodyweight,
            active: a.active,
          }))}
        />

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-lg">Current numbers</h2>
            <ExportCsvButton
              rows={rows.map((r) => ({
                name: r.athlete.name,
                position: r.athlete.position ?? "",
                gradYear: r.athlete.gradYear ?? "",
                bodyweight: r.athlete.bodyweight ?? "",
                lifts: r.lifts,
                acwr: r.stats.acwr,
              }))}
            />
          </div>
          <p className="text-sm text-muted mb-3">Click a player&rsquo;s name for their day-by-day log.</p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted uppercase text-xs tracking-wide">
                  <th className="py-1.5 pr-3">Athlete</th>
                  {LIFTS.map((l) => (
                    <th key={l.key} className="py-1.5 pr-3 whitespace-nowrap">
                      {l.label}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3">ACWR (this week)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={LIFTS.length + 2} className="py-6 text-center text-muted border-t border-line">
                      No active athletes yet. Add your roster above.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.athlete.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                      <Link href={`/coach/athletes/${r.athlete.id}`} className="hover:text-accent hover:underline">
                        {r.athlete.name}
                      </Link>
                    </td>
                    {LIFTS.map((l) => (
                      <td key={l.key} className="py-2 pr-3 num">
                        {r.lifts[l.key] != null ? r.lifts[l.key] : <span className="text-muted">&mdash;</span>}
                      </td>
                    ))}
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                          r.status.tone === "good"
                            ? "bg-good-bg text-good"
                            : r.status.tone === "warning"
                            ? "bg-warning-bg text-warning"
                            : r.status.tone === "danger"
                            ? "bg-danger-bg text-danger"
                            : "bg-line text-muted"
                        }`}
                      >
                        {r.status.label}
                        {r.stats.acwr != null ? ` · ${Math.round(r.stats.acwr * 100) / 100}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
