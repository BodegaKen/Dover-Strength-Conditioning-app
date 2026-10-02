import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllTracks } from "@/lib/prescription";

export async function GET() {
  const state = await prisma.programState.findUnique({ where: { id: "current" } });
  if (!state) {
    // Default to the very first track/period until a coach sets one.
    const tracks = getAllTracks();
    return NextResponse.json({ trackKey: tracks[0].key, week: 1, isDefault: true });
  }
  return NextResponse.json({ trackKey: state.trackKey, week: state.week, isDefault: false });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const trackKey = (body?.trackKey ?? "").toString();
  const week = Number(body?.week);
  if (!trackKey || !Number.isFinite(week) || week < 1) {
    return NextResponse.json({ error: "Pick a valid track and week." }, { status: 400 });
  }
  const valid = getAllTracks().some((t) => t.key === trackKey);
  if (!valid) return NextResponse.json({ error: "Unknown track." }, { status: 400 });

  const state = await prisma.programState.upsert({
    where: { id: "current" },
    create: { id: "current", trackKey, week },
    update: { trackKey, week },
  });
  return NextResponse.json({ trackKey: state.trackKey, week: state.week });
}
