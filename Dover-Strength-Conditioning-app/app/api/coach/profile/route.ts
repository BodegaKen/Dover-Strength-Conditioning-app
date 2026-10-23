import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";

// Any signed-in coach can change their own display name. The sign-in username and the PIN
// are untouched, so nobody gets signed out and nothing needs resetting.
export async function PATCH(req: NextRequest) {
  const me = await getCoachApi();
  if (!me) return NextResponse.json({ error: "Coach access only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().replace(/\s+/g, " ").trim();
  if (name.length < 2) return NextResponse.json({ error: "Enter a name (at least 2 characters)." }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Keep the name to 80 characters or fewer." }, { status: 400 });
  if (/[\u0000-\u001f<>]/.test(name)) return NextResponse.json({ error: "That name has characters that aren't allowed." }, { status: 400 });

  if (name === me.name) return NextResponse.json({ ok: true, name });

  await prisma.user.update({ where: { id: me.id }, data: { name } });
  await audit(me, "changed own name", name, `was ${me.name}`);
  return NextResponse.json({ ok: true, name });
}
