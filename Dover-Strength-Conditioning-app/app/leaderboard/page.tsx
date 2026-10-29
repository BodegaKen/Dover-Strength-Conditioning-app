import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import { LIFTS, shownE1RM } from "@/lib/calc";
import { sprintTable } from "@/lib/sprints";
import type { AthleteRecord, TestEntryRecord } from "@/lib/types";

// The four barbell lifts, plus the 40-yard dash (coach-entered, hand-timed).
const BOARD_LIFTS = ["squat", "bench", "deadlift", "ohp"];

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
      latestByAthleteLift[t.athleteId][t.lift] = shownE1RM(t.lift, t.e1RM, t.bodyweightAtTest);
    }
  }

  const perLift = LIFTS.filter((l) => BOARD_LIFTS.includes(l.key)).map((l) => {
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

  // 40-yard dash: each athlete's best (fastest) hand-timed time ever, fastest first. A missing table
  // (before `prisma db push`) just leaves the board empty.
  let dash: { name: string; gradYear: number | null; val: number }[] = [];
  try {
    const rows: { athleteId: string; seconds: number }[] = await sprintTable().findMany({ where: { event: "dash40" } });
    const best = new Map<string, number>();
    for (const r of rows) {
      const cur = best.get(r.athleteId);
      if (cur == null || r.seconds < cur) best.set(r.athleteId, r.seconds);
    }
    dash = athletes
      .filter((a) => best.has(a.id))
      .map((a) => ({ name: a.name, gradYear: a.gradYear, val: best.get(a.id) as number }))
      .sort((a, b) => a.val - b.val)
      .slice(0, 5);
  } catch {
    dash = [];
  }

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
              <span className="text-fg font-semibold">40-Yard Dash</span> is each player&rsquo;s fastest time ever. Coaches
              time it by hand and enter it, so close times are within the noise of hand timing.
            </li>
            <li>Players who graduate stay on the board, so records last past a player&rsquo;s senior year.</li>
          </ul>
          <p className="text-xs text-muted mt-2">Only the leaderboard is shared between players &mdash; nobody&rsquo;s daily logs are visible to teammates.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {perLift.map((p) => (
            <LbCard key={p.key} title={p.label} entries={p.entries} unit="lb" />
          ))}
          <LbCard title="40-Yard Dash" entries={dash} unit="s" />
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
  unit: "lb" | "s";
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
                {unit === "s" ? `${e.val.toFixed(2)} s` : `${Math.round(e.val * 10) / 10} lb`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
