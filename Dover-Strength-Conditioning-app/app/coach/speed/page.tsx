import { redirect } from "next/navigation";
import { getCoachPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/calc";
import { validDate } from "@/lib/validate";
import { SPRINT_EVENTS, sprintEvent, sprintTable, fmtSeconds } from "@/lib/sprints";
import NavBar from "@/components/NavBar";
import SpeedEntry, { type SpeedRow } from "./SpeedEntry";

// Coach entry for hand-timed speed tests (Phase 3 Test Week and Retest Week, plus anything else you time).
// Athletes never type these; they see them on their Progress page.
export default async function SpeedPage({ searchParams }: { searchParams: { e?: string; d?: string } }) {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");

  const ev = sprintEvent(searchParams.e) ?? SPRINT_EVENTS[0];
  const date = searchParams.d && validDate(searchParams.d) ? searchParams.d : todayISO();

  const athletes = await prisma.user.findMany({
    where: { role: "PLAYER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, position: true },
  });
  const ids = athletes.map((a) => a.id);

  let all: { athleteId: string; seconds: number; date: string }[] | null = null;
  try {
    all = await sprintTable().findMany({ where: { event: ev.key, athleteId: { in: ids } }, orderBy: { date: "asc" } });
  } catch {
    all = null;
  }

  const today = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const s of all ?? []) {
    if (s.date === date) today.set(s.athleteId, s.seconds);
    else if (s.date < date) prev.set(s.athleteId, s.seconds); // ascending, so the last one wins = most recent before this day
  }
  const rows: SpeedRow[] = athletes.map((a) => ({
    id: a.id,
    name: a.name,
    position: a.position,
    value: today.has(a.id) ? fmtSeconds(today.get(a.id)!) : "",
    prev: prev.has(a.id) ? fmtSeconds(prev.get(a.id)!) : null,
  }));

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
          <h2 className="text-lg">Speed tests</h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted uppercase text-xs tracking-wide">Event</span>
              <select name="e" defaultValue={ev.key} className="rounded-md border border-line bg-bg px-2 py-1.5">
                {SPRINT_EVENTS.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted uppercase text-xs tracking-wide">Date</span>
              <input type="date" name="d" defaultValue={date} className="rounded-md border border-line bg-bg px-2 py-1.5" />
            </label>
            <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm uppercase tracking-wide">Go</button>
          </form>
          {all == null && (
            <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">
              The speed-test table doesn&rsquo;t exist yet. Run `npx prisma db push` once, then reload.
            </div>
          )}
          <p className="text-xs text-muted">
            Enter each athlete&rsquo;s best hand-timed attempt for {ev.label.toLowerCase()} on this date, in seconds (for example 4.85). Saving again
            for the same day replaces the earlier time; clear a box and save to remove one. Compare group changes between test and retest, and
            treat one athlete&rsquo;s change under about 0.15 s as noise (a coach-set rule of thumb for hand timing).
          </p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <SpeedEntry key={`${ev.key}|${date}`} event={ev.key} date={date} rows={rows} />
        </div>
      </main>
    </div>
  );
}
