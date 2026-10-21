import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcE1RM, pullupSystemE1RM } from "@/lib/calc";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { validDate } from "@/lib/validate";

// Coach-only: correct or remove a test max entered for any athlete.
async function requireCoach() {
  const session = await getApiSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (session.role !== "COACH") return { error: NextResponse.json({ error: "Coach only." }, { status: 403 }) };
  const coach = await getCoachApi();
  if (!coach) return { error: NextResponse.json({ error: "Coach only." }, { status: 403 }) };
  return { session, coach };
}

const LIFT_KEYS = ["squat", "bench", "deadlift", "ohp", "pullup"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const data: { fiveRM?: number; e1RM?: number; date?: string; lift?: string; bodyweightAtTest?: number | null } = {};
  if (body && "fiveRM" in body) {
    const fiveRM = Number(body.fiveRM);
    if (!(fiveRM > 0 && fiveRM <= 2000)) return NextResponse.json({ error: "Enter a positive 5RM." }, { status: 400 });
    data.fiveRM = fiveRM;
    data.e1RM = calcE1RM(fiveRM);
  }
  if (body && "date" in body) {
    if (!validDate(String(body.date))) return NextResponse.json({ error: "Bad date." }, { status: 400 });
    data.date = String(body.date);
  }
  if (body && "lift" in body) {
    if (!LIFT_KEYS.includes(String(body.lift))) return NextResponse.json({ error: "Unknown lift." }, { status: 400 });
    data.lift = String(body.lift);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const existing = await prisma.testEntry.findUnique({ where: { id: params.id }, include: { athlete: true } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  // Pull-up entries carry a total-load e1RM, so any change to the lift or the added weight
  // (or an explicit bodyweight) recomputes it from bodyweight + added weight.
  const finalLift = data.lift ?? existing.lift;
  const finalFive = data.fiveRM ?? existing.fiveRM;
  if (finalLift === "pullup") {
    const bwIn = body && "bodyweight" in body && String(body.bodyweight).trim() !== "" ? Number(body.bodyweight) : null;
    const bw = bwIn ?? existing.bodyweightAtTest ?? existing.athlete.bodyweight;
    if (bw == null || !(bw >= 50 && bw <= 600)) {
      return NextResponse.json({ error: "A weighted pull-up entry needs the athlete's bodyweight (50-600 lb)." }, { status: 400 });
    }
    data.bodyweightAtTest = bw;
    data.e1RM = pullupSystemE1RM(finalFive, bw);
  } else if (data.lift && existing.lift === "pullup") {
    data.e1RM = calcE1RM(finalFive);
    data.bodyweightAtTest = null;
  }
  const test = await prisma.testEntry.update({ where: { id: params.id }, data });
  await audit(auth.coach, "edit test entry", existing.athlete.name, `${existing.lift} ${existing.date}`);
  return NextResponse.json({ test });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const existing = await prisma.testEntry.findUnique({ where: { id: params.id }, include: { athlete: true } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  await prisma.testEntry.delete({ where: { id: params.id } });
  await audit(auth.coach, "delete test entry", existing.athlete.name, `${existing.lift} ${existing.date}`);
  return NextResponse.json({ ok: true });
}
