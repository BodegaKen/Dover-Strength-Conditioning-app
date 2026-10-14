import { NextRequest, NextResponse } from "next/server";
import { getApiSession, hashPin, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireCoach() {
  const session = await getApiSession();
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
  // This route manages athlete accounts only; coach accounts can't be edited, reset or removed here.
  if (athlete.role !== "PLAYER") {
    return NextResponse.json({ error: "Only athlete accounts can be managed here." }, { status: 403 });
  }

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
  if ("gradYear" in (body ?? {})) {
    const g = body.gradYear ? Number(body.gradYear) : null;
    if (g != null && !(Number.isInteger(g) && g >= 2020 && g <= 2040)) {
      return NextResponse.json({ error: "Grad year must be a real year." }, { status: 400 });
    }
    data.gradYear = g;
  }
  if ("bodyweight" in (body ?? {})) {
    const bw = body.bodyweight ? Number(body.bodyweight) : null;
    if (bw != null && !(bw >= 50 && bw <= 600)) {
      return NextResponse.json({ error: "Bodyweight must be 50-600 lb." }, { status: 400 });
    }
    data.bodyweight = bw;
  }
  if (body?.pullupTrack === "BODYWEIGHT" || body?.pullupTrack === "WEIGHTED") {
    data.pullupTrack = body.pullupTrack;
  }
  if (body?.trainingTrack === "FULL" || body?.trainingTrack === "MULTI_SPORT") {
    data.trainingTrack = body.trainingTrack;
  }
  await prisma.user.update({ where: { id: athlete.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (target && target.role !== "PLAYER") {
    return NextResponse.json({ error: "Only athlete accounts can be managed here." }, { status: 403 });
  }
  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
