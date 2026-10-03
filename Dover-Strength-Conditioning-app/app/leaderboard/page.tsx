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
        return val != null ? { name: a.name, gradYear: a.gradYear, val } : null;
      })
      .filter((x): x is { name: string; gradYear: number | null; val: number } => x !== null)
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);
    return { key: l.key, label: l.label, entries };
  });

  const totals = athletes
    .map((a) => {
      const lifts = latestByAthleteLift[a.id] ?? {};
      if (!TOTAL_LIFTS.every((k) => k in lifts)) return null;
      const sum = TOTAL_LIFTS.reduce((s, k) => s + lifts[k], 0);
      return { name: a.name, gradYear: a.gradYear, val: sum };
    })
    .filter((x): x is { name: string; gradYear: number | null; val: number } => x !== null)
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  const relative = athletes
    .map((a) => {
      const lifts = latestByAthleteLift[a.id] ?? {};
      if (!a.bodyweight || !TOTAL_LIFTS.every((k) => k in lifts)) return null;
      const sum = TOTAL_LIFTS.reduce((s, k) => s + lifts[k], 0);
      return { name: a.name, gradYear: a.gradYear, val: sum / a.bodyweight };
    })
    .filter((x): x is { name: string; gradYear: number | null; val: number } => x !== null)
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  return (
    <div>
      <NavBar role={user.role} name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg">Team Leaderboard</h2>
          <p className="text-sm text-muted mt-1">
            The all-time top 5 in the program for each lift. It ranks each player&rsquo;s most recent{" "}
            <span className="text-fg font-semibold">tested max</span>, shown as an estimated one-rep max (e1RM = tested 5-rep
            max &divide; 0.87). It moves when someone logs a new test max &mdash; the weights you log in your daily workouts
            don&rsquo;t change it.
          </p>
          <ul className="text-sm text-muted mt-2 list-disc ml-5 flex flex-col gap-0.5">
            <li>
              <span className="text-fg font-semibold">Big-4 Total</span> adds squat + bench + deadlift + overhead press. A
              player needs all four tested to appear.
            </li>
            <li>
              <span className="text-fg font-semibold">Relative Strength</span> is that total divided by bodyweight, so
              smaller players can climb it too.
            </li>
            <li>
              <span className="text-fg font-semibold">Weighted Pull-up</span> ranks the added weight only.
            </li>
            <li>Players who graduate stay on the board, so records last past a player&rsquo;s senior year.</li>
          </ul>
          <p className="text-xs text-muted mt-2">Only the leaderboard is shared between players &mdash; nobody&rsquo;s daily logs are visible to teammates.</p>
        </div>
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
  entries: { name: string; gradYear: number | null; val: number }[];
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
              <span className="flex-1 truncate">
                <span className="font-semibold">{e.name}</span>
                {e.gradYear ? <span className="text-muted text-sm"> &rsquo;{String(e.gradYear).slice(-2)}</span> : ""}
              </span>
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
