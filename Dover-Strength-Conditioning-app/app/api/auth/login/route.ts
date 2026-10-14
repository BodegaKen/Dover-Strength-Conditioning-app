import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, signSession, pinFingerprint, SESSION_COOKIE } from "@/lib/auth";

// Wrong-PIN throttling, stored on the user row so it holds across serverless
// instances. The attempt counter is incremented atomically BEFORE the PIN is
// checked, so even a burst of parallel guesses gets at most MAX_FAILS real checks
// per lock cycle. Counter and lock reset on a correct PIN or when a lock expires.
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
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

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000));
    return NextResponse.json(
      { error: `Too many wrong attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }
  if (user.lockedUntil && user.lockedUntil <= now) {
    // Lock expired: clear it and start a fresh set of attempts.
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }

  const { failedLogins } = await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: { increment: 1 } },
    select: { failedLogins: true },
  });
  // The counter only reads above MAX_FAILS after the lock-expiry reset above, so a
  // fresh cycle allows MAX_FAILS checks. Anything past that is refused unchecked.
  if (failedLogins > MAX_FAILS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) },
    });
    return NextResponse.json(
      { error: `Too many wrong attempts. Try again in about ${LOCK_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  const ok = await verifyPin(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

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
