import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPin, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireCoach() {
  const session = await getSession();
  if (!session || session.role !== "COACH") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = (body?.action ?? "update").toString();

  const athlete = await prisma.user.findUnique({ where: { id: params.id } });
  if (!athlete) return NextResponse.json({ error: "Athlete not found." }, { status: 404 });

  if (action === "archive") {
    await prisma.user.update({ where: { id: athlete.id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    await prisma.user.update({ where: { id: athlete.id }, data: { active: true } });
    return NextResponse.json({ ok: true });
  }
  if (action === "resetPin") {
    const pin = randomPin();
    const pinHash = await hashPin(pin);
    await prisma.user.update({
      where: { id: athlete.id },
      data: { pinHash, mustChangePin: true },
    });
    return NextResponse.json({ ok: true, pin });
  }

  // action === "update"
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("position" in (body ?? {})) data.position = body.position ? String(body.position).trim() : null;
  if ("bodyweight" in (body ?? {})) data.bodyweight = body.bodyweight ? Number(body.bodyweight) : null;
  if (body?.pullupTrack === "BODYWEIGHT" || body?.pullupTrack === "WEIGHTED") {
    data.pullupTrack = body.pullupTrack;
  }
  await prisma.user.update({ where: { id: athlete.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
