import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPin, slugifyUsername, randomPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseRosterPaste(text: string): { name: string; position: string }[] {
  return text
    .split("\n")
    .map((line) => {
      let raw = line.replace(/ /g, " ").trim();
      if (!raw) return null;
      raw = raw.replace(/^#?\d{1,3}\s+/, "");
      if (!raw) return null;
      const parts = raw
        .split(/\t|,| - /)
        .map((p) => p.trim())
        .filter(Boolean);
      if (!parts.length) return null;
      return { name: parts[0], position: parts.length > 1 ? parts.slice(1).join(" / ") : "" };
    })
    .filter((x): x is { name: string; position: string } => x !== null);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString();
  const entries = parseRosterPaste(text);
  if (!entries.length) return NextResponse.json({ error: "Nothing to add." }, { status: 400 });

  const existing: { name: string }[] = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e: { name: string }) => e.name.toLowerCase()));

  const created: { name: string; username: string; pin: string }[] = [];
  let skipped = 0;
  for (const entry of entries) {
    if (existingNames.has(entry.name.toLowerCase())) {
      skipped++;
      continue;
    }
    let username = slugifyUsername(entry.name);
    let n = 2;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${slugifyUsername(entry.name)}-${n}`;
      n++;
    }
    const pin = randomPin();
    const pinHash = await hashPin(pin);
    await prisma.user.create({
      data: {
        name: entry.name,
        username,
        position: entry.position || null,
        pinHash,
        role: "PLAYER",
      },
    });
    created.push({ name: entry.name, username, pin });
    existingNames.add(entry.name.toLowerCase());
  }

  return NextResponse.json({ created, skipped });
}
