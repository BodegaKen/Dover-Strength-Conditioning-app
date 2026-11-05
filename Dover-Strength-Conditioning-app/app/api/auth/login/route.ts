import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, signSession, pinFingerprint, SESSION_COOKIE } from "@/lib/auth";
import { pinProblemFor } from "@/lib/pinpolicy";
import { claimPinAttempt, clearPinFailures, MAX_FAILS, LOCK_MINUTES } from "@/lib/throttle";

// Wrong-PIN throttling lives in lib/throttle.ts (shared with change-pin).
const GENERIC_ERROR = `Wrong username or PIN. After ${MAX_FAILS} wrong tries an account is locked for ${LOCK_MINUTES} minutes.`;
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

  // A locked account answers exactly like a wrong PIN or an unknown username (same message, same status,
  // same time cost), so a locked response cannot be used to find out which usernames exist.
  const gate = await claimPinAttempt(user);
  if (!gate.allowed) {
    await verifyPin(pin, DUMMY_HASH);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ok = await verifyPin(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await clearPinFailures(user.id);

  // A PIN set before the current strength rules (or by the seed or an admin) is checked here, the one
  // moment the plain PIN is in hand; a PIN that does not meet today's rules must be changed now.
  const weakPin = pinProblemFor(user.role, pin) !== null;
  let mustChangePin = user.mustChangePin;
  if (weakPin && !mustChangePin) {
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePin: true } });
    mustChangePin = true;
  }

  const token = await signSession({ sub: user.id, role: user.role, pv: await pinFingerprint(user.pinHash) });
  const res = NextResponse.json({
    ok: true,
    role: user.role,
    mustChangePin,
    weakPin,
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
