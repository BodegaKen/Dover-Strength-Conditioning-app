import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPeriod, getTrack, computeTargetWeight, formatSetsReps } from "@/lib/prescription";
import { LIFTS } from "@/lib/calc";
import NavBar from "@/components/NavBar";
import LogForms from "./LogForms";

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
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {LIFTS.map((l) => {
              const lift = period?.lifts?.[l.key];
              if (!lift) return null;
              const e1rm = latestByLift[l.key]?.e1RM;
              const target = e1rm != null ? computeTargetWeight(e1rm, lift.pctE1RM) : null;
              return (
                <div key={l.key} className="border border-line rounded-lg p-3">
                  <div className="font-bold">{l.label}</div>
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
            })}
          </div>
        </div>

        <LogForms
          currentE1RMs={Object.fromEntries(LIFTS.map((l) => [l.key, latestByLift[l.key]?.e1RM ?? null]))}
        />
      </main>
    </div>
  );
}
