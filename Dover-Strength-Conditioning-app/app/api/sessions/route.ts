import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayISO, addDaysISO } from "@/lib/calc";
import { SESSION_TYPES, MAX_SESSION_MIN, validDate } from "@/lib/validate";

// Athletes can log or rate a session dated up to this many days back; older ones go through a coach.
const PLAYER_DATE_WINDOW_DAYS = 14;

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Players only ever see their own sessions; a coach can see everyone's, or
  // one athlete's via ?athleteId=.
  const requested = req.nextUrl.searchParams.get("athleteId");
  const athleteId = session.role === "COACH" ? requested ?? undefined : session.sub;
  const sessions = await prisma.sessionEntry.findMany({
    where: athleteId ? { athleteId } : undefined,
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const type = (body?.type ?? "lift").toString();
  const date = (body?.date ?? todayISO()).toString();
  const rpe = Number(body?.rpe);
  const durationMin = Number(body?.durationMin);
  let athleteId = (body?.athleteId ?? session.sub).toString();
  if (session.role !== "COACH") athleteId = session.sub;

  if (!(Number.isInteger(rpe) && rpe >= 0 && rpe <= 10) || !(durationMin > 0 && durationMin <= MAX_SESSION_MIN)) {
    return NextResponse.json({ error: "RPE must be a whole number 0-10 and duration must be 1-600 minutes." }, { status: 400 });
  }
  if (!SESSION_TYPES.includes(type)) return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  if (!validDate(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete || athlete.role !== "PLAYER") return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });
  if (session.role !== "COACH") {
    const today = todayISO();
    if (date > today || date < addDaysISO(today, -PLAYER_DATE_WINDOW_DAYS)) {
      return NextResponse.json(
        { error: `Use a date from the past ${PLAYER_DATE_WINDOW_DAYS} days. Ask a coach to enter an older session.` },
        { status: 400 }
      );
    }
  }

  // One entry per athlete, day and session type: logging it again replaces the first instead of adding a
  // second one, so a day's workload cannot be counted twice. (Two practices in one day are logged as one
  // entry with the total minutes.) Done in one serializable transaction so simultaneous requests cannot
  // both add a row.
  const load = rpe * durationMin;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.sessionEntry.findFirst({ where: { athleteId, type, date } });
        if (existing) {
          const updated = await tx.sessionEntry.update({ where: { id: existing.id }, data: { rpe, durationMin, load } });
          return { entry: updated, replaced: true };
        }
        const created = await tx.sessionEntry.create({ data: { athleteId, type, date, rpe, durationMin, load } });
        return { entry: created, replaced: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ session: result.entry, replaced: result.replaced });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2034") {
      return NextResponse.json({ error: "Another entry was saving at the same moment. Try again." }, { status: 409 });
    }
    throw e;
  }
}
