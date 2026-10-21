import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllTracks } from "@/lib/prescription";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";

export async function GET() {
  if (!(await getApiSession())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  if (!state) {
    // Default to the very first track/period until a coach sets one.
    const tracks = getAllTracks();
    return NextResponse.json({ trackKey: tracks.find((t) => t.key === "phase1")?.key ?? tracks[0].key, week: 1, isDefault: true });
  }
  return NextResponse.json({ trackKey: state.trackKey, week: state.week, isDefault: false });
}

export async function PATCH(req: NextRequest) {
  const session = await getCoachApi();
  if (!session) {
    return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const trackKey = (body?.trackKey ?? "").toString();
  const week = Number(body?.week);
  if (!trackKey || !Number.isInteger(week) || week < 1 || week > 60) {
    return NextResponse.json({ error: "Pick a valid track and week." }, { status: 400 });
  }
  const valid = getAllTracks().some((t) => t.key === trackKey);
  if (!valid) return NextResponse.json({ error: "Unknown track." }, { status: 400 });

  const state = await prisma.programState.upsert({
    where: { id: "current" },
    create: { id: "current", trackKey, week },
    update: { trackKey, week },
  });
  await audit(session, "set team phase/week", null, `${state.trackKey} week ${state.week}`);
  return NextResponse.json({ trackKey: state.trackKey, week: state.week });
}
