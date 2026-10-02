import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, signSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = (body?.username ?? "").toString().trim().toLowerCase();
  const pin = (body?.pin ?? "").toString().trim();
  if (!username || !pin) {
    return NextResponse.json({ error: "Enter your username and PIN." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "No account found with that username." }, { status: 401 });
  }
  const ok = await verifyPin(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
  }

  const token = await signSession({ sub: user.id, role: user.role });
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
