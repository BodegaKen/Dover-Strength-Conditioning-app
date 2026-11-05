import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { calcE1RM, pullupSystemE1RM, todayISO, mondayOf, addDaysISO } from "@/lib/calc";
import { LIFT_KEYS, MAX_FIVE_RM, validDate } from "@/lib/validate";
import { getPeriod } from "@/lib/prescription";
import { isTestPeriod } from "@/lib/plan";
import { audit } from "@/lib/audit";
import { getCoachApi } from "@/lib/admin";

// Limits that apply to a test an ATHLETE enters for himself (a coach can enter anything). These are
// coach-set sanity bounds to catch typos and tampering, not training standards. Weights in lb;
// the pull-up figure is the ADDED weight.
const PLAYER_MAX_FIVE_RM: Record<string, number> = { squat: 800, deadlift: 800, bench: 600, ohp: 400, pullup: 300 };
const PLAYER_MAX_JUMP = 1.25; // a new e1RM more than 25% above the athlete's last one for that lift needs a coach
const PLAYER_BW_CHANGE = 0.15; // a player can change the bodyweight on file by at most 15%; more goes through a coach

// Raised inside the save transaction to stop with a message instead of a server error.
class RuleError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

  // An athlete can enter max tests only in a Testing or Retest week (the same rule the dashboard uses to
  // show the form), for a recent date, and within sane limits. Anything else goes through a coach.
  const byPlayer = session.role !== "COACH";
  if (byPlayer) {
    const state = await prisma.programState.findUnique({ where: { id: "current" } });
    if (!isTestPeriod(getPeriod(state?.trackKey ?? "phase1", state?.week ?? 1))) {
      return NextResponse.json({ error: "Max tests are entered during Testing Week and retest weeks. Ask a coach to enter a make-up test." }, { status: 403 });
    }
    // One self-entered test per lift per calendar week (enforced inside the save below), dated this week.
    const today = todayISO();
    if (date > today || mondayOf(date) !== mondayOf(today)) {
      return NextResponse.json({ error: "Use a date from this week. Ask a coach to enter an older test." }, { status: 400 });
    }
    const cap = PLAYER_MAX_FIVE_RM[lift];
    if (cap && fiveRM > cap) {
      return NextResponse.json({ error: `That looks too high to enter yourself (over ${cap} lb). Check for a typo, or ask a coach to enter it.` }, { status: 400 });
    }
  }

  // Weighted pull-up: fiveRM is the ADDED weight, and the e1RM is taken on total system load
  // (bodyweight + added weight), so bodyweight is recorded with the test.
  let e1RM = calcE1RM(fiveRM);
  let bodyweightAtTest: number | null = null;
  let bodyweightToSave: number | null = null; // written only once the test itself is accepted
  if (lift === "pullup") {
    const given = body?.bodyweight != null && String(body.bodyweight).trim() !== "" ? Number(body.bodyweight) : athlete.bodyweight;
    if (given == null || !(given >= 50 && given <= 600)) {
      return NextResponse.json({ error: "Enter the athlete's bodyweight (50-600 lb) with a weighted pull-up test." }, { status: 400 });
    }
    if (byPlayer && athlete.bodyweight != null && Math.abs(given - athlete.bodyweight) > athlete.bodyweight * PLAYER_BW_CHANGE) {
      return NextResponse.json(
        { error: "That bodyweight is far from the one on file. Check for a typo, or ask a coach to update your bodyweight." },
        { status: 400 }
      );
    }
    bodyweightAtTest = given;
    e1RM = pullupSystemE1RM(fiveRM, given);
    if (athlete.bodyweight !== given) bodyweightToSave = given;
  }

  // The week check, the jump check and the save run as one serializable transaction, so two requests
  // sent at the same moment cannot both pass the check.
  let test;
  try {
    test = await prisma.$transaction(
      async (tx) => {
        if (byPlayer) {
          const weekStart = mondayOf(date);
          const already = await tx.testEntry.findFirst({
            where: { athleteId, lift, date: { gte: weekStart, lte: addDaysISO(weekStart, 6) } },
          });
          if (already) {
            throw new RuleError("You already entered this test this week. If it is wrong, ask a coach to correct it.", 409);
          }
          const prior = await tx.testEntry.findFirst({ where: { athleteId, lift }, orderBy: { date: "desc" } });
          if (prior && e1RM > prior.e1RM * PLAYER_MAX_JUMP) {
            throw new RuleError("That is a big jump from your last test. Check for a typo; if it is right, ask a coach to enter it.", 400);
          }
        }
        const created = await tx.testEntry.create({ data: { athleteId, lift, fiveRM, e1RM, bodyweightAtTest, date } });
        if (bodyweightToSave != null) await tx.user.update({ where: { id: athleteId }, data: { bodyweight: bodyweightToSave } });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e) {
    if (e instanceof RuleError) return NextResponse.json({ error: e.message }, { status: e.status });
    if ((e as { code?: string })?.code === "P2034") {
      return NextResponse.json({ error: "Another entry was saving at the same moment. Try again." }, { status: 409 });
    }
    throw e;
  }
  if (!byPlayer) {
    const coach = await getCoachApi();
    if (coach) await audit(coach, "enter test for athlete", athlete.name, `${lift} 5RM ${fiveRM}, ${date}`);
  }
  return NextResponse.json({ test });
}
