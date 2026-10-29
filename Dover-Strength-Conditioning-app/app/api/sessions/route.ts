import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/calc";
import { SESSION_TYPES, MAX_SESSION_MIN, validDate } from "@/lib/validate";

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
  if (!athlete) return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });

  const load = rpe * durationMin;
  // The post-session prompt sends replace: true so rating the same day's lift twice
  // updates the one entry instead of doubling that day's load.
  if (body?.replace === true) {
    const existing = await prisma.sessionEntry.findFirst({ where: { athleteId, type, date } });
    if (existing) {
      const updated = await prisma.sessionEntry.update({
        where: { id: existing.id },
        data: { rpe, durationMin, load },
      });
      return NextResponse.json({ session: updated });
    }
  }
  const entry = await prisma.sessionEntry.create({
    data: { athleteId, type, date, rpe, durationMin, load },
  });
  return NextResponse.json({ session: entry });
}
