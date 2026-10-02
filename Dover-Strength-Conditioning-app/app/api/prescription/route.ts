import { NextRequest, NextResponse } from "next/server";
import { getPeriod, getTrack } from "@/lib/prescription";

export async function GET(req: NextRequest) {
  const trackKey = req.nextUrl.searchParams.get("trackKey") ?? "";
  const week = Number(req.nextUrl.searchParams.get("week") ?? "1");
  const track = getTrack(trackKey);
  if (!track) return NextResponse.json({ error: "Unknown track." }, { status: 404 });
  const period = getPeriod(trackKey, week);
  return NextResponse.json({
    trackKey: track.key,
    trackName: track.name,
    trailingNote: track.trailingNote ?? null,
    period,
  });
}
