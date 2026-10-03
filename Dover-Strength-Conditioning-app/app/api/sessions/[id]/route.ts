import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Coach-only: correct or remove a session (RPE + duration) entered for any athlete.
async function requireCoach() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (session.role !== "COACH") return { error: NextResponse.json({ error: "Coach only." }, { status: 403 }) };
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const existing = await prisma.sessionEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  const rpe = body && "rpe" in body ? Number(body.rpe) : existing.rpe;
  const durationMin = body && "durationMin" in body ? Number(body.durationMin) : existing.durationMin;
  const date = body && "date" in body ? String(body.date) : existing.date;
  const type = body && "type" in body ? String(body.type) : existing.type;
  if (!(rpe >= 0 && rpe <= 10) || !(durationMin > 0)) {
    return NextResponse.json({ error: "RPE must be 0-10 and duration must be positive." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
  if (!["lift", "practice", "game"].includes(type)) return NextResponse.json({ error: "Unknown type." }, { status: 400 });

  const session = await prisma.sessionEntry.update({
    where: { id: params.id },
    data: { rpe, durationMin, date, type, load: rpe * durationMin },
  });
  return NextResponse.json({ session });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;
  const existing = await prisma.sessionEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  await prisma.sessionEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
