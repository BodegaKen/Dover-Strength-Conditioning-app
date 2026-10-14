// Edge-safe session-token helpers (jose + Web Crypto only). The middleware imports
// from here, so nothing in this file may pull in Prisma, bcrypt or next/headers.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dover_sc_session";
export const SESSION_DAYS = 30;

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

// What is signed into the cookie. `pv` fingerprints the PIN hash the token was
// issued against, so resetting or changing a PIN invalidates older tokens.
export type TokenClaims = {
  sub: string; // user id
  role: "PLAYER" | "COACH";
  pv?: string;
};

// What getSession() returns after checking the database: role, active state and
// mustChangePin all come from the current user record, not from the token.
export type SessionPayload = TokenClaims & { mustChangePin?: boolean };

export async function pinFingerprint(pinHash: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pinHash));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSession(payload: TokenClaims): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub === "string" && (payload.role === "PLAYER" || payload.role === "COACH")) {
      return {
        sub: payload.sub,
        role: payload.role,
        pv: typeof payload.pv === "string" ? payload.pv : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}
