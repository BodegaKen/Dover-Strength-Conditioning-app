import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcE1RM, todayISO } from "@/lib/calc";
import { LIFT_KEYS, MAX_FIVE_RM, validDate } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Players only ever see their own tests; a coach can see everyone's, or
  // one athlete's via ?athleteId=.
  const requested = req.nextUrl.searchParams.get("athleteId");
  const athleteId = session.role === "COACH" ? requested ?? undefined : session.sub;
  const tests = await prisma.testEntry.findMany({
    where: athleteId ? { athleteId } : undefined,
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lift = (body?.lift ?? "").toString();
  const fiveRM = Number(body?.fiveRM);
  const date = (body?.date ?? todayISO()).toString();
  // A coach can log on behalf of any athlete; a player can only log their own.
  let athleteId = (body?.athleteId ?? session.sub).toString();
  if (session.role !== "COACH") athleteId = session.sub;

  if (!LIFT_KEYS.includes(lift)) return NextResponse.json({ error: "Unknown lift." }, { status: 400 });
  if (!(fiveRM > 0 && fiveRM <= MAX_FIVE_RM)) {
    return NextResponse.json({ error: "Enter a positive 5RM (up to 2000 lb)." }, { status: 400 });
  }
  if (!validDate(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete) return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });

  const e1RM = calcE1RM(fiveRM);
  const test = await prisma.testEntry.create({
    data: { athleteId, lift, fiveRM, e1RM, date },
  });
  return NextResponse.json({ test });
}
