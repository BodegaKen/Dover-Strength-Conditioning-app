import { NextRequest, NextResponse } from "next/server";
import { getApiSession, hashPin, slugifyUsername, randomPin, weakPinReason } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireCoach() {
  const session = await getApiSession();
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
  // Select only what the roster needs; credential fields stay out of this path.
  const athletes = await prisma.user.findMany({
    where: { role: "PLAYER" },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, username: true, position: true, gradYear: true, bodyweight: true,
      pullupTrack: true, trainingTrack: true, active: true, mustChangePin: true,
    },
  });
  return NextResponse.json({ athletes });
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
  if (bodyweight != null && !(bodyweight >= 50 && bodyweight <= 600)) {
    return NextResponse.json({ error: "Bodyweight must be 50-600 lb." }, { status: 400 });
  }
  if (gradYear != null && !(Number.isInteger(gradYear) && gradYear >= 2020 && gradYear <= 2040)) {
    return NextResponse.json({ error: "Grad year must be a real year." }, { status: 400 });
  }
  const suppliedPin = body?.pin != null && String(body.pin).trim() !== "" ? String(body.pin).trim() : null;
  if (suppliedPin) {
    const weak = weakPinReason(suppliedPin);
    if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  }
  const pin = suppliedPin ?? randomPin();

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
