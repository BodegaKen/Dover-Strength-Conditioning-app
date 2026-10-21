import { NextRequest, NextResponse } from "next/server";
import { hashPin, slugifyUsername, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";

// Coach accounts. Full admins only: any coach can see the list, but only an admin can add,
// reset, deactivate or change the admin flag (see [id]/route.ts).

async function uniqueUsername(base: string): Promise<string> {
  const root = slugifyUsername(base);
  let candidate = root;
  let n = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${root}-${n}`;
    n++;
  }
  return candidate;
}

export async function GET() {
  const coach = await getCoachApi();
  if (!coach) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const coaches = await prisma.user.findMany({
    where: { role: "COACH" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true, isAdmin: true, active: true, mustChangePin: true },
  });
  return NextResponse.json({ coaches });
}

export async function POST(req: NextRequest) {
  const coach = await getCoachApi();
  if (!coach) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  if (!coach.isAdmin) return NextResponse.json({ error: "Only a full admin coach can add coaches." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const isAdmin = body?.isAdmin === true;

  // Temporary 6-digit PIN, shown once to the admin; the new coach must change it at first sign-in.
  const pin = randomPin();
  const username = await uniqueUsername(name);
  const created = await prisma.user.create({
    data: { name, username, pinHash: await hashPin(pin), role: "COACH", isAdmin, mustChangePin: true },
  });
  await audit(coach, "add coach", created.name, isAdmin ? "full admin" : "limited coach");
  return NextResponse.json({ coach: { id: created.id, name: created.name, username: created.username, isAdmin }, pin });
}
