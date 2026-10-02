import { NextResponse } from "next/server";
import { getAllTracks } from "@/lib/prescription";

export async function GET() {
  const tracks = getAllTracks().map((t) => ({
    key: t.key,
    name: t.name,
    periods: t.periods.map((p) => ({ index: p.index, label: p.label })),
  }));
  return NextResponse.json({ tracks });
}
