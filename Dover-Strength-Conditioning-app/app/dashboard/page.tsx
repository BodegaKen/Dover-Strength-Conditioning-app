import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPeriod, getTrack, computeTargetWeight, formatSetsReps, type RawLift } from "@/lib/prescription";
import { LIFTS, type LiftKey } from "@/lib/calc";
import { buildPlanDays, dayProgress, isTestPeriod, laneFor, type TrainingTrack, type PullupMode } from "@/lib/plan";
import { weekInfo } from "@/lib/schedule";
import NavBar from "@/components/NavBar";
import DayCards from "@/components/DayCards";
import LogForms from "./LogForms";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type LiftItem = { key: LiftKey; label: string; lift: RawLift };

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
  const planDays = buildPlanDays({ trackKey, period, variant, pullupMode, position: user.position }).filter((d) => !d.isTest);
  const setRows = await prisma.setLog.findMany({ where: { athleteId: user.id, trackKey, week } });

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

  const info = weekInfo(trackKey, week);
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
          {info?.dates && <div className="text-sm text-muted mt-0.5">{info.dates}</div>}
          {info?.note && <p className="text-sm mt-2">{info.note}</p>}
          {trackLabel && <div className="text-sm text-muted mt-1">{trackLabel}</div>}
          {(trackKey === "phase1" || trackKey === "phase2") && !testWeek && (
            <p className="text-xs text-muted mt-2">
              Load bias: linemen train at the upper end of the +/-2.5% band around the prescribed %, skill positions at the
              lower end. Your coach will tell you which you are.
            </p>
          )}
          {(trackKey === "phase1" || trackKey === "phase2") && !testWeek && laneFor(user.position, period?.index ?? 1).mixed && (
            <p className="text-xs text-muted mt-1">
              You play a lineman spot on one side of the ball and a skill spot on the other, so you alternate: this is a{" "}
              <span className="text-fg font-semibold">
                {laneFor(user.position, period?.index ?? 1).lane === "LINE" ? "lineman" : "skill"}
              </span>{" "}
              week
              {trackKey === "phase1"
                ? laneFor(user.position, period?.index ?? 1).lane === "LINE"
                  ? " (standard circuit stations)."
                  : " (Jump Station replaces one circuit station)."
                : "."}
            </p>
          )}
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
              Log each max with &ldquo;Log a test max&rdquo; below. Start every test day with the NMT warm-up.
            </p>
          </div>
        ) : planDays.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-4 text-sm text-muted">
            No barbell lifts are scheduled for this period.
          </div>
        ) : (
          <DayCards
            days={planDays}
            rows={setRows}
            latest={latestByLift}
            dayNotes={info?.dayNotes}
          />
        )}

        <LogForms
          currentE1RMs={Object.fromEntries(LIFTS.map((l) => [l.key, latestByLift[l.key]?.e1RM ?? null]))}
        />
      </main>
    </div>
  );
}
