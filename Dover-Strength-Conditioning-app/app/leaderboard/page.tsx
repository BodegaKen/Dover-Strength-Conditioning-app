import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import { LIFTS, TOTAL_LIFTS } from "@/lib/calc";
import type { AthleteRecord, TestEntryRecord } from "@/lib/types";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");

  // All-time: every athlete ever entered, active or archived, so a record
  // set one season still stands after that player graduates.
  const athletes: AthleteRecord[] = await prisma.user.findMany({ where: { role: "PLAYER" } });
  const tests: TestEntryRecord[] = await prisma.testEntry.findMany({ orderBy: { date: "desc" } });

  const latestByAthleteLift: Record<string, Record<string, number>> = {};
  for (const t of tests) {
    latestByAthleteLift[t.athleteId] ??= {};
    if (!(t.lift in latestByAthleteLift[t.athleteId])) {
      latestByAthleteLift[t.athleteId][t.lift] = t.e1RM;
    }
  }

  const perLift = LIFTS.map((l) => {
    const entries = athletes
      .map((a) => {
        const val = latestByAthleteLift[a.id]?.[l.key];
        return val != null ? { name: a.name, val } : null;
      })
      .filter((x): x is { name: string; val: number } => x !== null)
      .sort((a, b) => b.val - a.val)
      .slice(0, 10);
    return { key: l.key, label: l.label, entries };
  });

  const totals = athletes
    .map((a) => {
      const lifts = latestByAthleteLift[a.id] ?? {};
      if (!TOTAL_LIFTS.every((k) => k in lifts)) return null;
      const sum = TOTAL_LIFTS.reduce((s, k) => s + lifts[k], 0);
      return { name: a.name, val: sum };
    })
    .filter((x): x is { name: string; val: number } => x !== null)
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  const relative = athletes
    .map((a) => {
      const lifts = latestByAthleteLift[a.id] ?? {};
      if (!a.bodyweight || !TOTAL_LIFTS.every((k) => k in lifts)) return null;
      const sum = TOTAL_LIFTS.reduce((s, k) => s + lifts[k], 0);
      return { name: a.name, val: sum / a.bodyweight };
    })
    .filter((x): x is { name: string; val: number } => x !== null)
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  return (
    <div>
      <NavBar role={user.role} name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <LbCard title="Big-4 Total (Squat+Bench+DL+OHP)" entries={totals} unit="lb" />
          {perLift.map((p) => (
            <LbCard key={p.key} title={p.label} entries={p.entries} unit="lb" />
          ))}
          {relative.length > 0 && (
            <LbCard title="Relative Strength (Total ÷ bodyweight)" entries={relative} unit="x" />
          )}
        </div>
      </main>
    </div>
  );
}

function LbCard({
  title,
  entries,
  unit,
}: {
  title: string;
  entries: { name: string; val: number }[];
  unit: "lb" | "x";
}) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h3 className="text-base mb-2">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entries.map((e, i) => (
            <li key={e.name + i} className="flex items-baseline gap-2">
              <span className="num text-muted w-5">{i + 1}</span>
              <span className="flex-1 font-semibold truncate">{e.name}</span>
              <span className={`num font-semibold ${i === 0 ? "text-accent" : ""}`}>
                {unit === "x" ? `${(Math.round(e.val * 100) / 100).toFixed(2)}×` : `${Math.round(e.val * 10) / 10} lb`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
