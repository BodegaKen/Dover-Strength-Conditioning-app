import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPeriod } from "@/lib/prescription";
import { buildPlanDays, dayProgress, BACKOFF_BASE, type TrainingTrack, type PullupMode } from "@/lib/plan";
import { todayISO } from "@/lib/calc";

// Saves (or clears) the sets an athlete entered for one prescribed day of the
// team's current week. The plan is rebuilt server-side from ProgramState and
// the athlete's own track settings - the client only says which day and what
// numbers - so a stale or tampered page can't log against the wrong week.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);

  // Players log for themselves; a coach may log on behalf of an athlete.
  let athleteId = session.sub;
  if (session.role === "COACH" && body?.athleteId) athleteId = String(body.athleteId);

  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete) return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });

  const planDay = String(body?.planDay ?? "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date ?? "")) ? String(body.date) : todayISO();
  const entries: unknown = body?.entries;
  if (!planDay || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Missing day or entries." }, { status: 400 });
  }

  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  const trackKey = state?.trackKey ?? "phase1";
  const week = state?.week ?? 1;
  const variant = (athlete.trainingTrack ?? "FULL") as TrainingTrack;
  const pullupMode = (athlete.pullupTrack ?? "BODYWEIGHT") as PullupMode;

  const days = buildPlanDays({ trackKey, period: getPeriod(trackKey, week), variant, pullupMode, position: athlete.position });
  const day = days.find((d) => d.day === planDay && !d.isTest);
  if (!day) return NextResponse.json({ error: "That day isn't loggable this week." }, { status: 400 });

  type Clean = { lift: string; setNumber: number; weight: number | null; reps: number | null };
  const clean: Clean[] = [];
  for (const raw of entries as any[]) {
    const lift = String(raw?.lift ?? "");
    const setNumber = Number(raw?.setNumber);
    const ex = day.exercises.find((e) => e.lift === lift);
    if (!ex || !Number.isInteger(setNumber)) {
      return NextResponse.json({ error: "Unknown exercise or set." }, { status: 400 });
    }
    const isBackoff = setNumber > BACKOFF_BASE;
    const maxSet = isBackoff ? BACKOFF_BASE + (ex.backoff?.sets ?? 0) : ex.sets;
    if (setNumber < 1 || setNumber > maxSet) {
      return NextResponse.json({ error: "Set number out of range." }, { status: 400 });
    }
    const w = raw?.weight === "" || raw?.weight == null ? null : Number(raw.weight);
    const r = raw?.reps === "" || raw?.reps == null ? null : Number(raw.reps);
    if ((w != null && !(w >= 0 && w <= 2000)) || (r != null && !(Number.isInteger(r) && r >= 0 && r <= 200))) {
      return NextResponse.json({ error: "Weights and reps must be sensible numbers." }, { status: 400 });
    }
    clean.push({ lift, setNumber, weight: w, reps: r });
  }

  const key = (c: { lift: string; setNumber: number }) => ({
    athleteId_trackKey_week_planDay_lift_setNumber: {
      athleteId,
      trackKey,
      week,
      planDay,
      lift: c.lift,
      setNumber: c.setNumber,
    },
  });

  await prisma.$transaction(
    clean.map((c) =>
      c.weight == null && c.reps == null
        ? prisma.setLog.deleteMany({ where: { athleteId, trackKey, week, planDay, lift: c.lift, setNumber: c.setNumber } })
        : prisma.setLog.upsert({
            where: key(c),
            create: {
              athleteId, date, trackKey, week, planDay,
              variant, pullupMode,
              lift: c.lift, setNumber: c.setNumber, weight: c.weight, reps: c.reps,
            },
            update: { date, weight: c.weight, reps: c.reps, variant, pullupMode },
          })
    )
  );

  const rows = await prisma.setLog.findMany({ where: { athleteId, trackKey, week, planDay } });
  const progress = dayProgress(day, rows);
  return NextResponse.json({ ok: true, progress });
}
