import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPin, verifyPin, signSession, pinFingerprint, weakPinReason, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Uses getSession() (not getApiSession) on purpose: this is the one endpoint an
// account with a temporary PIN is allowed to call.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPin = (body?.currentPin ?? "").toString().trim();
  const newPin = (body?.newPin ?? "").toString().trim();
  const weak = weakPinReason(newPin);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  if (newPin === currentPin) {
    return NextResponse.json({ error: "Pick a PIN different from your current one." }, { status: 400 });
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

  // The PIN changed, so older cookies stop working; hand this browser a fresh one.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession({ sub: user.id, role: user.role, pv: await pinFingerprint(pinHash) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
