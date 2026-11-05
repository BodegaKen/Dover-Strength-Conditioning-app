import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { validDate } from "@/lib/validate";
import { sprintEvent, sprintTable } from "@/lib/sprints";

// Coach speed-test entry (any coach). One request saves a whole roster column:
//   { event, date, entries: [{ athleteId, seconds: number | null }] }
// null clears that athlete's time for that event and day. Re-saving a day replaces the earlier value.
export async function POST(req: NextRequest) {
  const coach = await getCoachApi();
  if (!coach) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const ev = sprintEvent(body?.event);
  if (!ev) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const date = (body?.date ?? "").toString();
  if (!validDate(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
  const entries: unknown = body?.entries;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 500) {
    return NextResponse.json({ error: "Send between 1 and 500 entries." }, { status: 400 });
  }

  const players = await prisma.user.findMany({ where: { role: "PLAYER" }, select: { id: true, name: true } });
  const ok = new Set(players.map((p) => p.id));
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const clear: string[] = [];
  const save: { athleteId: string; seconds: number }[] = [];
  for (const raw of entries as any[]) {
    const athleteId = (raw?.athleteId ?? "").toString();
    if (!ok.has(athleteId)) return NextResponse.json({ error: "Unknown athlete in the list." }, { status: 400 });
    if (raw?.seconds === null || raw?.seconds === undefined || raw?.seconds === "") {
      clear.push(athleteId);
      continue;
    }
    const seconds = Math.round(Number(raw.seconds) * 100) / 100;
    if (!Number.isFinite(seconds) || seconds < ev.min || seconds > ev.max) {
      return NextResponse.json(
        { error: `${ev.label}: a time must be between ${ev.min} and ${ev.max} seconds (check for a typo).` },
        { status: 400 }
      );
    }
    save.push({ athleteId, seconds });
  }

  // Previous times, so the audit entry can show what was replaced or removed.
  const previous = new Map<string, number>();
  try {
    const prev = await sprintTable().findMany({ where: { event: ev.key, date, athleteId: { in: [...save.map((s) => s.athleteId), ...clear] } } });
    for (const r of prev as { athleteId: string; seconds: number }[]) previous.set(r.athleteId, r.seconds);
  } catch {
    /* the save below reports a missing table */
  }

  try {
    const t = sprintTable();
    if (clear.length) await t.deleteMany({ where: { event: ev.key, date, athleteId: { in: clear } } });
    for (const s of save) {
      await t.upsert({
        where: { athleteId_event_date: { athleteId: s.athleteId, event: ev.key, date } },
        create: { athleteId: s.athleteId, event: ev.key, seconds: s.seconds, date, enteredBy: coach.name },
        update: { seconds: s.seconds, enteredBy: coach.name },
      });
    }
  } catch {
    return NextResponse.json({ error: "The speed-test table doesn't exist yet. Run `npx prisma db push` once, then try again." }, { status: 500 });
  }
  const fmt = (id: string) => nameOf.get(id) ?? id;
  const savedList = save
    .filter((s) => previous.get(s.athleteId) !== s.seconds)
    .map((s) => `${fmt(s.athleteId)} ${previous.has(s.athleteId) ? `${previous.get(s.athleteId)} -> ` : ""}${s.seconds}`);
  const clearedList = clear.filter((id) => previous.has(id)).map((id) => `${fmt(id)} (was ${previous.get(id)})`);
  const detail = `${save.length} saved, ${clear.length} cleared. Changed: ${savedList.join("; ") || "none"}. Removed: ${clearedList.join("; ") || "none"}.`;
  await audit(coach, "speed_times", `${ev.label} ${date}`, detail.length > 3000 ? detail.slice(0, 3000) + "..." : detail);
  return NextResponse.json({ ok: true, saved: save.length, cleared: clear.length });
}
