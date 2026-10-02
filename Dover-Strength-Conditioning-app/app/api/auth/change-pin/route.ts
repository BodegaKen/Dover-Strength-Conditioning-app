import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPin, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPin = (body?.currentPin ?? "").toString().trim();
  const newPin = (body?.newPin ?? "").toString().trim();
  if (!/^\d{4,6}$/.test(newPin)) {
    return NextResponse.json({ error: "New PIN must be 4-6 digits." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const ok = await verifyPin(currentPin, user.pinHash);
  if (!ok) return NextResponse.json({ error: "Current PIN is wrong." }, { status: 401 });

  const pinHash = await hashPin(newPin);
  await prisma.user.update({
    where: { id: user.id },
    data: { pinHash, mustChangePin: false },
  });
  return NextResponse.json({ ok: true });
}
