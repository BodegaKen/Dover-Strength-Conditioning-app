import { NextRequest, NextResponse } from "next/server";
import { hashPin, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";

const requireCoach = getCoachApi;
const ADMIN_ONLY = "Only a full admin coach can do that.";

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
    await audit(session, "archive athlete", athlete.name);
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    await prisma.user.update({ where: { id: athlete.id }, data: { active: true } });
    await audit(session, "restore athlete", athlete.name);
    return NextResponse.json({ ok: true });
  }
  if (action === "resetPin") {
    if (!session.isAdmin) return NextResponse.json({ error: ADMIN_ONLY }, { status: 403 });
    const pin = randomPin();
    const pinHash = await hashPin(pin);
    await prisma.user.update({
      where: { id: athlete.id },
      data: { pinHash, mustChangePin: true },
    });
    await audit(session, "reset athlete PIN", athlete.name);
    return NextResponse.json({ ok: true, pin });
  }

  // action === "update"
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "Name can't be blank." }, { status: 400 });
    if (n.length > 60) return NextResponse.json({ error: "Name is too long (60 characters max)." }, { status: 400 });
    data.name = n;
  }
  if ("position" in (body ?? {})) {
    const p = body.position ? String(body.position).trim() : "";
    if (p.length > 30) return NextResponse.json({ error: "Position is too long (30 characters max)." }, { status: 400 });
    data.position = p || null;
  }
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

  // Log what actually changed, old -> new, so a position or weight change can be traced later.
  const LABEL: Record<string, string> = {
    name: "name",
    position: "position",
    gradYear: "grad year",
    bodyweight: "weight",
    pullupTrack: "pull-up track",
    trainingTrack: "track",
  };
  const current = athlete as unknown as Record<string, unknown>;
  const show = (v: unknown) => (v == null || v === "" ? "blank" : String(v));
  const changes = Object.entries(data)
    .filter(([k, v]) => current[k] !== v)
    .map(([k, v]) => `${LABEL[k] ?? k}: ${show(current[k])} -> ${show(v)}`);
  if (changes.length === 0) return NextResponse.json({ ok: true, changed: false });

  await prisma.user.update({ where: { id: athlete.id }, data });
  await audit(session, "edit athlete", athlete.name, changes.join("; "));
  return NextResponse.json({ ok: true, changed: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  if (!session.isAdmin) return NextResponse.json({ error: ADMIN_ONLY }, { status: 403 });
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true, name: true } });
  if (target && target.role !== "PLAYER") {
    return NextResponse.json({ error: "Only athlete accounts can be managed here." }, { status: 403 });
  }
  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  if (target) await audit(session, "delete athlete", target.name);
  return NextResponse.json({ ok: true });
}
