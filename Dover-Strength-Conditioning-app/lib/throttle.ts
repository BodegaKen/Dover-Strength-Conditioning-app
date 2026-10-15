import { prisma } from "@/lib/db";

// Wrong-PIN throttling shared by every endpoint that checks a PIN (login and
// change-pin), so neither can be used to dodge the other's limit. State lives on
// the user row so it holds across serverless instances. The counter is incremented
// atomically BEFORE the PIN is checked, so even a burst of parallel guesses gets at
// most MAX_FAILS real checks per lock cycle.
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

export type PinGate = { allowed: true } | { allowed: false; error: string };

export async function claimPinAttempt(user: { id: string; lockedUntil: Date | null }): Promise<PinGate> {
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000));
    return { allowed: false, error: `Too many wrong attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (user.lockedUntil && user.lockedUntil <= now) {
    // Lock expired: clear it and start a fresh set of attempts. Conditional on the
    // lock still being expired, so when parallel requests all saw the expired lock
    // only the first one resets the counter; the rest match no row and leave the
    // increments other requests already made alone.
    await prisma.user.updateMany({
      where: { id: user.id, lockedUntil: { lte: now } },
      data: { failedLogins: 0, lockedUntil: null },
    });
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
    return { allowed: false, error: `Too many wrong attempts. Try again in about ${LOCK_MINUTES} minutes.` };
  }
  return { allowed: true };
}

export async function clearPinFailures(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: null } });
}
