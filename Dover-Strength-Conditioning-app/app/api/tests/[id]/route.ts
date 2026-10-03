import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcE1RM } from "@/lib/calc";

// Coach-only: correct or remove a test max entered for any athlete.
async function requireCoach() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (session.role !== "COACH") return { error: NextResponse.json({ error: "Coach only." }, { status: 403 }) };
  return { session };
}

const LIFT_KEYS = ["squat", "bench", "deadlift", "ohp", "pullup"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const data: { fiveRM?: number; e1RM?: number; date?: string; lift?: string } = {};
  if (body && "fiveRM" in body) {
    const fiveRM = Number(body.fiveRM);
    if (!(fiveRM > 0 && fiveRM <= 2000)) return NextResponse.json({ error: "Enter a positive 5RM." }, { status: 400 });
    data.fiveRM = fiveRM;
    data.e1RM = calcE1RM(fiveRM);
  }
  if (body && "date" in body) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) return NextResponse.json({ error: "Bad date." }, { status: 400 });
    data.date = String(body.date);
  }
  if (body && "lift" in body) {
    if (!LIFT_KEYS.includes(String(body.lift))) return NextResponse.json({ error: "Unknown lift." }, { status: 400 });
    data.lift = String(body.lift);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const existing = await prisma.testEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  const test = await prisma.testEntry.update({ where: { id: params.id }, data });
  return NextResponse.json({ test });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const existing = await prisma.testEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  await prisma.testEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
