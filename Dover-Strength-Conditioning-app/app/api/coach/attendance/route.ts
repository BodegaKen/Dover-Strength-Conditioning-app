import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { validDate } from "@/lib/validate";

// Coach roll call (any coach, full admin or limited). One row per athlete per day.
//   { date, athleteId, present: true | false | null }   null clears the mark
//   { date, bulk: "present" | "clear" }                  every active athlete on the roster
export async function POST(req: NextRequest) {
  const coach = await getCoachApi();
  if (!coach) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const date = (body?.date ?? "").toString();
  if (!validDate(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });

  if (body?.bulk === "present" || body?.bulk === "clear") {
    const athletes = await prisma.user.findMany({ where: { role: "PLAYER", active: true }, select: { id: true } });
    if (body.bulk === "clear") {
      await prisma.attendance.deleteMany({ where: { date, athleteId: { in: athletes.map((a) => a.id) } } });
    } else {
      await prisma.$transaction(
        athletes.map((a) =>
          prisma.attendance.upsert({
            where: { athleteId_date: { athleteId: a.id, date } },
            create: { athleteId: a.id, date, present: true, markedBy: coach.name },
            update: { present: true, markedBy: coach.name },
          })
        )
      );
    }
    return NextResponse.json({ ok: true });
  }

  const athleteId = (body?.athleteId ?? "").toString();
  const athlete = await prisma.user.findUnique({ where: { id: athleteId }, select: { role: true } });
  if (!athlete || athlete.role !== "PLAYER") return NextResponse.json({ error: "Unknown athlete." }, { status: 404 });

  if (body?.present === null) {
    await prisma.attendance.deleteMany({ where: { athleteId, date } });
    return NextResponse.json({ ok: true });
  }
  if (typeof body?.present !== "boolean") return NextResponse.json({ error: "present must be true, false or null." }, { status: 400 });
  await prisma.attendance.upsert({
    where: { athleteId_date: { athleteId, date } },
    create: { athleteId, date, present: body.present, markedBy: coach.name },
    update: { present: body.present, markedBy: coach.name },
  });
  return NextResponse.json({ ok: true });
}
