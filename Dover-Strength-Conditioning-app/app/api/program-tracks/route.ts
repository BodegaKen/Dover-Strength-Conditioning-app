import { NextResponse } from "next/server";
import { getAllTracks } from "@/lib/prescription";
import { getApiSession } from "@/lib/auth";

export async function GET() {
  if (!(await getApiSession())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const tracks = getAllTracks().map((t) => ({
    key: t.key,
    name: t.name,
    periods: t.periods.map((p) => ({ index: p.index, label: p.label })),
  }));
  return NextResponse.json({ tracks });
}
