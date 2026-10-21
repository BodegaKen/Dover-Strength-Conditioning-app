import { NextRequest, NextResponse } from "next/server";
import { hashPin, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";

// Full admins only. Actions: resetPin | archive | restore | setAdmin ({ isAdmin: boolean }).
// A coach can't archive or demote their own account, and the last active admin can't be
// archived or demoted, so the team can't lock itself out.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCoachApi();
  if (!me) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  if (!me.isAdmin) return NextResponse.json({ error: "Only a full admin coach can do that." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = (body?.action ?? "").toString();
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.role !== "COACH") return NextResponse.json({ error: "Coach not found." }, { status: 404 });

  if (action === "resetPin") {
    const pin = randomPin();
    // Resetting your own PIN here would just sign you out with a PIN you must change; use Change PIN instead.
    if (target.id === me.id) return NextResponse.json({ error: "Change your own PIN from the Change PIN screen." }, { status: 400 });
    await prisma.user.update({ where: { id: target.id }, data: { pinHash: await hashPin(pin), mustChangePin: true } });
    await audit(me, "reset coach PIN", target.name);
    return NextResponse.json({ ok: true, pin });
  }

  const wouldLoseLastAdmin = async () => {
    if (!target.isAdmin || !target.active) return false;
    const others = await prisma.user.count({ where: { role: "COACH", isAdmin: true, active: true, id: { not: target.id } } });
    return others === 0;
  };

  if (action === "archive") {
    if (target.id === me.id) return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
    if (await wouldLoseLastAdmin()) return NextResponse.json({ error: "That is the last active full admin." }, { status: 400 });
    await prisma.user.update({ where: { id: target.id }, data: { active: false } });
    await audit(me, "deactivate coach", target.name);
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    await prisma.user.update({ where: { id: target.id }, data: { active: true } });
    await audit(me, "restore coach", target.name);
    return NextResponse.json({ ok: true });
  }
  if (action === "setAdmin") {
    const next = body?.isAdmin === true;
    if (!next) {
      if (target.id === me.id) return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
      if (await wouldLoseLastAdmin()) return NextResponse.json({ error: "That is the last active full admin." }, { status: 400 });
    }
    await prisma.user.update({ where: { id: target.id }, data: { isAdmin: next } });
    await audit(me, next ? "make coach full admin" : "make coach limited", target.name);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
