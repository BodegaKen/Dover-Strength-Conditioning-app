import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, signSession, pinFingerprint, SESSION_COOKIE } from "@/lib/auth";
import { claimPinAttempt, clearPinFailures } from "@/lib/throttle";

// Wrong-PIN throttling lives in lib/throttle.ts (shared with change-pin).
const GENERIC_ERROR = "Wrong username or PIN.";
// Valid bcrypt hash of a throwaway string, compared against when the username is
// unknown or inactive so those requests cost the same time as a real one.
const DUMMY_HASH = "$2a$10$995AUMdMdKS.8Xglc1e1tOGX02Ipg6p74PKBXlKLd/Hf342o.zu9y";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = (body?.username ?? "").toString().trim().toLowerCase();
  const pin = (body?.pin ?? "").toString().trim();
  if (!username || !pin) {
    return NextResponse.json({ error: "Enter your username and PIN." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    await verifyPin(pin, DUMMY_HASH);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const gate = await claimPinAttempt(user);
  if (!gate.allowed) return NextResponse.json({ error: gate.error }, { status: 429 });

  const ok = await verifyPin(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await clearPinFailures(user.id);

  const token = await signSession({ sub: user.id, role: user.role, pv: await pinFingerprint(user.pinHash) });
  const res = NextResponse.json({
    ok: true,
    role: user.role,
    mustChangePin: user.mustChangePin,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
