import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/calc";

export async function GET(req: NextRequest) {
  const session = await getSession();
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const type = (body?.type ?? "lift").toString();
  const date = (body?.date ?? todayISO()).toString();
  const rpe = Number(body?.rpe);
  const durationMin = Number(body?.durationMin);
  let athleteId = (body?.athleteId ?? session.sub).toString();
  if (session.role !== "COACH") athleteId = session.sub;

  if (!(rpe >= 0 && rpe <= 10) || !(durationMin > 0)) {
    return NextResponse.json({ error: "RPE must be 0-10 and duration must be positive." }, { status: 400 });
  }
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete) return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });

  const load = rpe * durationMin;
  const entry = await prisma.sessionEntry.create({
    data: { athleteId, type, date, rpe, durationMin, load },
  });
  return NextResponse.json({ session: entry });
}
