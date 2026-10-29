import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TestEntryRecord } from "@/lib/types";
import NavBar from "@/components/NavBar";
import { shownE1RM } from "@/lib/calc";
import { SPRINT_EVENTS, fmtSeconds, sprintTable } from "@/lib/sprints";
import ProgressCharts from "./ProgressCharts";

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");

  const tests: TestEntryRecord[] = await prisma.testEntry.findMany({
    where: { athleteId: user.id },
    orderBy: { date: "asc" },
  });

  // Coach-entered speed times (hand-timed). Empty until a coach has timed this athlete, and empty (not an
  // error) if the table hasn't been created yet.
  let sprints: { event: string; seconds: number; date: string }[] = [];
  try {
    sprints = await sprintTable().findMany({ where: { athleteId: user.id }, orderBy: { date: "asc" } });
  } catch {
    sprints = [];
  }
  const speedCards = SPRINT_EVENTS.map((ev) => ({ ev, rows: sprints.filter((s) => s.event === ev.key) })).filter((c) => c.rows.length > 0);

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <ProgressCharts
          tests={tests.map((t: TestEntryRecord) => ({ date: t.date, lift: t.lift, e1RM: shownE1RM(t.lift, t.e1RM, t.bodyweightAtTest) }))}
        />
        {speedCards.length > 0 && (
          <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-base">Speed tests</h3>
              <p className="text-xs text-muted">Timed by your coaches by hand. Lower is faster.</p>
            </div>
            {speedCards.map(({ ev, rows }) => {
              const first = rows[0];
              const last = rows[rows.length - 1];
              const best = Math.min(...rows.map((r) => r.seconds));
              const delta = Math.round((last.seconds - first.seconds) * 100) / 100;
              return (
                <div key={ev.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-semibold">{ev.label}</div>
                    <div className="num">
                      {fmtSeconds(last.seconds)} s
                      {rows.length > 1 && (
                        <span className={`text-sm ml-2 ${delta < 0 ? "text-good" : "text-muted"}`}>
                          ({delta > 0 ? "+" : ""}{delta.toFixed(2)} since first)
                        </span>
                      )}
                    </div>
                  </div>
                  {rows.length > 1 && (
                  <ul className="text-sm text-muted mt-1 flex flex-col gap-0.5">
                    {rows.map((r) => (
                      <li key={r.date} className="flex justify-between">
                        <span>{r.date}</span>
                        <span className="num">{fmtSeconds(r.seconds)} s{r.seconds === best && rows.length > 1 ? " (best)" : ""}</span>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
