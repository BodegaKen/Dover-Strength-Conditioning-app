import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPeriod, getTrack, computeTargetWeight, formatSetsReps, type RawLift } from "@/lib/prescription";
import { LIFTS, type LiftKey } from "@/lib/calc";
import NavBar from "@/components/NavBar";
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

  const latestTests = await prisma.testEntry.findMany({
    where: { athleteId: user.id },
    orderBy: { date: "desc" },
  });
  const latestByLift: Record<string, (typeof latestTests)[number]> = {};
  for (const t of latestTests) {
    if (!latestByLift[t.lift]) latestByLift[t.lift] = t;
  }

  const liftItems: LiftItem[] = LIFTS.map(
    (l): { key: LiftKey; label: string; lift: RawLift | undefined } => ({
      key: l.key,
      label: l.label,
      lift: period?.lifts?.[l.key] as RawLift | undefined,
    })
  ).filter((item): item is LiftItem => Boolean(item.lift));

  // Testing/retest weeks spread max-effort lifts across specific days rather
  // than everyone testing everything in one sitting - group by day when the
  // program data specifies one (data/program-data.json's "day" field),
  // otherwise fall back to the normal flat grid every other week uses.
  const hasDayInfo = liftItems.some((item) => item.lift.day);
  const dayGroups: { day: string; items: LiftItem[] }[] = [];
  if (hasDayInfo) {
    const byDay = new Map<string, LiftItem[]>();
    for (const item of liftItems) {
      const day = item.lift.day ?? "Unscheduled";
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(item);
    }
    for (const [day, items] of byDay.entries()) {
      dayGroups.push({ day, items });
    }
    dayGroups.sort((a, b) => {
      const ai = DAY_ORDER.indexOf(a.day);
      const bi = DAY_ORDER.indexOf(b.day);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  function LiftCard({ item }: { item: LiftItem }) {
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
        ) : e1rm == null && lift.pctE1RM != null ? (
          <div className="text-sm text-warning mt-1">Log a test max to see your weight.</div>
        ) : (
          <div className="text-sm text-muted mt-1">{lift.note}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold">
            {track?.name ?? "Program"}
          </div>
          <h2 className="text-lg mt-0.5">{period?.label ?? "This week"}</h2>
          {track?.trailingNote && (
            <p className="text-sm text-muted mt-2">{track.trailingNote}</p>
          )}

          {hasDayInfo ? (
            <div className="flex flex-col gap-4 mt-3">
              {dayGroups.map((group) => (
                <div key={group.day}>
                  <div className="text-xs uppercase tracking-wide text-muted font-semibold mb-1.5">
                    {group.day}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {group.items.map((item) => (
                      <LiftCard key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted">
                No test is scheduled Thursday &mdash; it&rsquo;s open for rest, or to make up a missed Monday/Tuesday test.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {liftItems.map((item) => (
                <LiftCard key={item.key} item={item} />
              ))}
            </div>
          )}
        </div>

        <LogForms
          currentE1RMs={Object.fromEntries(LIFTS.map((l) => [l.key, latestByLift[l.key]?.e1RM ?? null]))}
        />
      </main>
    </div>
  );
}
