import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPin, slugifyUsername, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AthleteRecord } from "@/lib/types";

async function requireCoach() {
  const session = await getSession();
  if (!session || session.role !== "COACH") return null;
  return session;
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = slugifyUsername(base);
  let n = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${slugifyUsername(base)}-${n}`;
    n++;
  }
  return candidate;
}

export async function GET() {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const athletes: AthleteRecord[] = await prisma.user.findMany({
    where: { role: "PLAYER" },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    athletes: athletes.map((a: AthleteRecord) => ({
      id: a.id,
      name: a.name,
      username: a.username,
      position: a.position,
      gradYear: a.gradYear,
      bodyweight: a.bodyweight,
      pullupTrack: a.pullupTrack,
      trainingTrack: a.trainingTrack,
      active: a.active,
      mustChangePin: a.mustChangePin,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireCoach();
  if (!session) return NextResponse.json({ error: "Coach access only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const position = body?.position ? body.position.toString().trim() : null;
  const bodyweight = body?.bodyweight ? Number(body.bodyweight) : null;
  const gradYear = body?.gradYear ? Number(body.gradYear) : null;
  const pin = (body?.pin ?? randomPin()).toString();

  const username = await uniqueUsername(name);
  const pinHash = await hashPin(pin);
  const athlete = await prisma.user.create({
    data: { name, username, position, gradYear, bodyweight, pinHash, role: "PLAYER" },
  });
  return NextResponse.json({
    athlete: { id: athlete.id, name: athlete.name, username: athlete.username },
    pin, // shown once so the coach can hand it to the player
  });
}
