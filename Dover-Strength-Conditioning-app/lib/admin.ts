import { getApiSession, getSession } from "./auth";
import { prisma } from "./db";

export type CoachCtx = { id: string; name: string; isAdmin: boolean };

// Full admin = a coach flagged isAdmin. Bootstrap rule: until at least one coach carries the
// flag (right after the schema change, before the seed has run), every coach counts as an
// admin so nobody is locked out of their own roster.
async function adminFlag(user: { role: string; isAdmin: boolean }): Promise<boolean> {
  if (user.role !== "COACH") return false;
  if (user.isAdmin) return true;
  const admins = await prisma.user.count({ where: { role: "COACH", isAdmin: true, active: true } });
  return admins === 0;
}

// For API route handlers: the signed-in coach (account must have changed its temporary PIN),
// or null.
export async function getCoachApi(): Promise<CoachCtx | null> {
  const s = await getApiSession();
  if (!s || s.role !== "COACH") return null;
  const u = await prisma.user.findUnique({ where: { id: s.sub }, select: { id: true, name: true, role: true, isAdmin: true } });
  if (!u) return null;
  return { id: u.id, name: u.name, isAdmin: await adminFlag(u) };
}

// For server components (pages): same, but based on getSession().
export async function getCoachPage(): Promise<CoachCtx | null> {
  const s = await getSession();
  if (!s || s.role !== "COACH") return null;
  // A coach still on a temporary PIN gets nothing here; /dashboard sends them to change it.
  if (s.mustChangePin) return null;
  const u = await prisma.user.findUnique({ where: { id: s.sub }, select: { id: true, name: true, role: true, isAdmin: true } });
  if (!u) return null;
  return { id: u.id, name: u.name, isAdmin: await adminFlag(u) };
}
