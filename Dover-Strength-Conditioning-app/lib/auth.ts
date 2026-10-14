import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySessionToken, pinFingerprint, type SessionPayload } from "./token";

// Token helpers live in ./token (edge-safe, used by the middleware); re-exported so
// existing "@/lib/auth" imports keep working.
export { SESSION_COOKIE, SESSION_DAYS, signSession, verifySessionToken, pinFingerprint } from "./token";
export type { SessionPayload, TokenClaims } from "./token";

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Server Components / Route Handlers only (reads the cookie jar directly).
// The token proves who signed in; the database decides whether that account may
// still act: it must exist, be active, and still hold the PIN the token was
// issued against. Role and mustChangePin come from the current user record.
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, role: true, active: true, mustChangePin: true, pinHash: true },
  });
  if (!user || !user.active) return null;
  if (claims.pv !== (await pinFingerprint(user.pinHash))) return null;
  return { sub: user.id, role: user.role, mustChangePin: user.mustChangePin };
}

// For API route handlers: same as getSession(), but an account that still has to
// change its temporary PIN gets nothing except the change-PIN and "me" endpoints
// (which call getSession() directly).
export async function getApiSession(): Promise<SessionPayload | null> {
  const s = await getSession();
  if (!s || s.mustChangePin) return null;
  return s;
}

export function slugifyUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "player";
}

// PINs that are trivially guessable (all one digit, straight runs) are refused
// when someone chooses their own, and are never generated.
export function weakPinReason(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "PIN must be 4-6 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Pick a PIN that isn't all the same digit.";
  const d = pin.split("").map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) {
    return "Pick a PIN that isn't a straight run like 1234 or 4321.";
  }
  return null;
}

// 4-digit PIN from a cryptographically secure source (Web Crypto), skipping weak ones.
export function randomPin(): string {
  const a = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(a);
    const pin = String(1000 + (a[0] % 9000));
    if (!weakPinReason(pin)) return pin;
  }
}
