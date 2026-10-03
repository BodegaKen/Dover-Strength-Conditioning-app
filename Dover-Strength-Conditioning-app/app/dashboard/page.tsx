import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPeriod, getTrack, computeTargetWeight, formatSetsReps, type RawLift } from "@/lib/prescription";
import { LIFTS, type LiftKey } from "@/lib/calc";
import { buildPlanDays, dayProgress, isTestPeriod, type TrainingTrack, type PullupMode, type PlanExercise } from "@/lib/plan";
import NavBar from "@/components/NavBar";
import LogForms from "./LogForms";
import SetLogger, { type ExerciseView } from "./SetLogger";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type LiftItem = { key: LiftKey; label: string; lift: RawLift };

// "70-75 (or RPE 7)" -> "70-75"; 75 -> 75; anything unparseable -> null
function leadingPct(p: number | string | null | undefined): number | string | null {
  if (p == null) return null;
  if (typeof p === "number") return p;
  const m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/.exec(p.trim());
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : parseFloat(m[1]);
}

function pctLabel(p: number | string | null | undefined): string {
  if (p == null) return "";
  if (typeof p === "number") return `${p}% e1RM`;
  const m = /^([\d.]+(?:\s*-\s*[\d.]+)?)(.*)$/.exec(p.trim());
  return m ? `${m[1]}% e1RM${m[2]}` : p;
}

function targetOf(e1rm: number | undefined, pct: number | string | null | undefined) {
  if (e1rm == null) return null;
  const t = computeTargetWeight(e1rm, leadingPct(pct));
  if (!t) return null;
  return { text: t.high ? `${t.low}-${t.high}` : `${t.low}`, first: t.low };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");
  if (user.mustChangePin) redirect("/change-pin");

  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  const trackKey = state?.trackKey ?? "phase1";
  const week = state?.week ?? 1;
  const track = getTrack(trackKey);
  const period = getPeriod(trackKey, week);
  const variant = (user.trainingTrack ?? "FULL") as TrainingTrack;
  const pullupMode = (user.pullupTrack ?? "BODYWEIGHT") as PullupMode;

  const latestTests = await prisma.testEntry.findMany({
    where: { athleteId: user.id },
    orderBy: { date: "desc" },
  });
  const latestByLift: Record<string, (typeof latestTests)[number]> = {};
  for (const t of latestTests) {
    if (!latestByLift[t.lift]) latestByLift[t.lift] = t;
  }

  const testWeek = isTestPeriod(period);
  const planDays = buildPlanDays({ trackKey, period, variant, pullupMode }).filter((d) => !d.isTest);
  const setRows = await prisma.setLog.findMany({ where: { athleteId: user.id, trackKey, week } });

  function viewOf(ex: PlanExercise): ExerciseView {
    const e1 = latestByLift[ex.lift]?.e1RM;
    let target = ex.entry === "weight" ? targetOf(e1, ex.pctE1RM) : null;
    if (ex.atTestedWeight && latestByLift[ex.lift]) {
      const fw = latestByLift[ex.lift].fiveRM;
      target = { text: `${fw}`, first: fw };
    }
    const bo = ex.backoff ? targetOf(e1, ex.backoff.pctE1RM) : null;
    return {
      lift: ex.lift,
      label: ex.label,
      sets: ex.sets,
      reps: ex.reps,
      pctLabel: ex.atTestedWeight ? "tested added weight" : pctLabel(ex.pctE1RM),
      target: target?.text ?? null,
      targetFirst: target?.first ?? null,
      entry: ex.entry,
      backoff: ex.backoff
        ? { sets: ex.backoff.sets, reps: ex.backoff.reps, pctLabel: pctLabel(ex.backoff.pctE1RM), target: bo?.text ?? null }
        : null,
      note: ex.note,
      hint: ex.entry === "weight" && target == null && e1 == null && (ex.pctE1RM != null || ex.atTestedWeight) ? "Log a test max to see your target weight." : undefined,
    };
  }

  // Testing / retest weeks: max-effort tests spread across specific days,
  // logged with the test form below rather than set by set.
  const liftItems: LiftItem[] = LIFTS.map(
    (l): { key: LiftKey; label: string; lift: RawLift | undefined } => ({
      key: l.key,
      label: l.label,
      lift: period?.lifts?.[l.key] as RawLift | undefined,
    })
  ).filter((item): item is LiftItem => Boolean(item.lift));
  const testGroups: { day: string; items: LiftItem[] }[] = [];
  if (testWeek) {
    const byDay = new Map<string, LiftItem[]>();
    for (const item of liftItems) {
      const day = item.lift.day ?? "Unscheduled";
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(item);
    }
    for (const [day, items] of byDay.entries()) testGroups.push({ day, items });
    testGroups.sort((a, b) => {
      const ai = DAY_ORDER.indexOf(a.day);
      const bi = DAY_ORDER.indexOf(b.day);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  function TestCard({ item }: { item: LiftItem }) {
    const { key, label, lift } = item;
    const e1rm = latestByLift[key]?.e1RM;
    const target = e1rm != null ? computeTargetWeight(e1rm, lift.pctE1RM) : null;
    return (
      <div className="border border-line rounded-lg p-3">
        <div className="font-bold">{label}</div>
        <div className="text-sm text-muted">
          {formatSetsReps(lift)} {lift.pctE1RM != null ? `@ ${lift.pctE1RM}% e1RM` : ""}
        </div>
        {target ? (
          <div className="num text-xl font-semibold mt-1">
            {target.high ? `${target.low}–${target.high}` : target.low} lb
          </div>
        ) : (
          <div className="text-sm text-muted mt-1">{lift.note}</div>
        )}
      </div>
    );
  }

  const trackLabel =
    trackKey === "phase1" || trackKey === "phase2"
      ? variant === "MULTI_SPORT"
        ? "Your track: Multi-Sport Maintenance (2 days/week)"
        : "Your track: Full (4 days/week)"
      : null;

  const progressByDay = planDays.map((d) => {
    const rows = setRows.filter((r) => r.planDay === d.day);
    return { day: d, rows, progress: dayProgress(d, rows) };
  });

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold">
            {track?.name ?? "Program"}
          </div>
          <h2 className="text-lg mt-0.5">{period?.label ?? "This week"}</h2>
          {trackLabel && <div className="text-sm text-muted mt-1">{trackLabel}</div>}
          {track?.trailingNote && <p className="text-sm text-muted mt-2">{track.trailingNote}</p>}

          {!testWeek && progressByDay.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {progressByDay.map(({ day, progress }) => (
                <span
                  key={day.day}
                  className={`text-xs rounded-full px-3 py-1 border ${
                    progress.complete
                      ? "border-good bg-good-bg text-good font-semibold"
                      : progress.started
                      ? "border-warning bg-warning-bg text-warning"
                      : "border-line text-muted"
                  }`}
                >
                  {progress.complete ? "✓ " : ""}
                  {day.day}
                  {progress.started && !progress.complete ? ` ${progress.done}/${progress.total}` : ""}
                </span>
              ))}
              <Link href="/calendar" className="text-xs uppercase tracking-wide text-accent font-semibold self-center ml-auto">
                Calendar &rarr;
              </Link>
            </div>
          )}
        </div>

        {testWeek ? (
          <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-4">
            {testGroups.map((group) => (
              <div key={group.day}>
                <div className="text-xs uppercase tracking-wide text-muted font-semibold mb-1.5">{group.day}</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <TestCard key={item.key} item={item} />
                  ))}
                </div>
              </div>
            ))}
            <p className="text-sm text-muted">
              No test is scheduled Thursday &mdash; it&rsquo;s open for rest, or to make up a missed Monday/Tuesday test.
              Log each max with &ldquo;Log a test max&rdquo; below.
            </p>
          </div>
        ) : planDays.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-4 text-sm text-muted">
            No barbell lifts are scheduled for this period.
          </div>
        ) : (
          progressByDay.map(({ day, rows, progress }) => {
            const latestDate = rows.map((r) => r.date).sort().pop();
            return (
              <div key={day.day} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base uppercase tracking-wide font-display">{day.day}</h3>
                  <span className={`text-xs ${progress.complete ? "text-good font-semibold" : "text-muted"}`}>
                    {progress.complete ? "Complete ✓" : `${progress.done}/${progress.total} sets`}
                  </span>
                </div>
                <SetLogger
                  planDay={day.day}
                  exercises={day.exercises.map(viewOf)}
                  initial={rows.map((r) => ({ lift: r.lift, setNumber: r.setNumber, weight: r.weight, reps: r.reps }))}
                  initialDate={latestDate}
                />
              </div>
            );
          })
        )}

        <LogForms
          currentE1RMs={Object.fromEntries(LIFTS.map((l) => [l.key, latestByLift[l.key]?.e1RM ?? null]))}
        />
      </main>
    </div>
  );
}
