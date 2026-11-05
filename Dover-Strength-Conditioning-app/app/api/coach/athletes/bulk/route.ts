import { NextRequest, NextResponse } from "next/server";
import { hashPin, slugifyUsername, randomPin, initialLastUsername } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoachApi } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { nameProblem, usernameProblem } from "@/lib/validate";

// Bounds for one paste: a roster is about 100 players, so these leave plenty of room while stopping a runaway request.
const MAX_PASTE_CHARS = 12000;
const MAX_ENTRIES = 150;
const MAX_POSITION_CHARS = 40;

// Pulls a trailing graduation-year token off the end of a string, however
// it's written: "2027", "'27" (apostrophe required for 2-digit so a bare
// number isn't mistaken for one), or "class of 2027"/"class of '27".
function splitGradYear(s: string): { text: string; gradYear: number | null } {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { text: s.trim(), gradYear: null };
  const last = tokens[tokens.length - 1];
  const hasApostrophe = /^'/.test(last);
  const digits = last.replace(/^'/, "");
  let y: number | null = null;
  if (/^\d{4}$/.test(digits)) {
    y = parseInt(digits, 10);
  } else if (/^\d{2}$/.test(digits) && hasApostrophe) {
    y = 2000 + parseInt(digits, 10);
  }
  if (y == null || y < 2000 || y > 2099) return { text: s.trim(), gradYear: null };

  let rest = tokens.slice(0, -1);
  if (
    rest.length >= 2 &&
    rest[rest.length - 2].toLowerCase() === "class" &&
    rest[rest.length - 1].toLowerCase() === "of"
  ) {
    rest = rest.slice(0, -2);
  }
  const text = rest.join(" ").replace(/[,/-]+$/, "").trim();
  return { text, gradYear: y };
}

function parseRosterPaste(text: string): { name: string; position: string; gradYear: number | null }[] {
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

      let name = parts[0];
      let position = parts.length > 1 ? parts.slice(1).join(" / ") : "";
      let gradYear: number | null;

      if (position) {
        // "John Smith, LB, 2027" or "Alex Rivera - RB '26" — year lives
        // at the end of the position field.
        const split = splitGradYear(position);
        position = split.text;
        gradYear = split.gradYear;
      } else {
        // No separator at all — "Chris Lee 2027" or "Chris Lee '27" — year
        // trails directly on the name.
        const split = splitGradYear(name);
        name = split.text || name;
        gradYear = split.gradYear;
      }

      return { name, position, gradYear };
    })
    .filter((x): x is { name: string; position: string; gradYear: number | null } => x !== null);
}

export async function POST(req: NextRequest) {
  const coach = await getCoachApi();
  if (!coach) {
    return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString();
  if (text.length > MAX_PASTE_CHARS) {
    return NextResponse.json({ error: `That paste is too long (over ${MAX_PASTE_CHARS} characters). Add the roster in smaller batches.` }, { status: 400 });
  }
  const entries = parseRosterPaste(text);
  if (!entries.length) return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
  if (entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `Add at most ${MAX_ENTRIES} athletes at a time (this paste has ${entries.length}).` }, { status: 400 });
  }
  // Same name rules as the single-athlete form; nothing is created if any line fails.
  for (const entry of entries) {
    entry.name = entry.name.replace(/\s+/g, " ").trim();
    const problem = nameProblem(entry.name) ?? (entry.position.length > MAX_POSITION_CHARS ? `Position is too long for "${entry.name}" (max ${MAX_POSITION_CHARS} characters).` : null);
    if (problem) return NextResponse.json({ error: `${entry.name ? `"${entry.name.slice(0, 40)}": ` : ""}${problem} Nothing was added.` }, { status: 400 });
  }

  const existing: { name: string }[] = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e: { name: string }) => e.name.toLowerCase()));

  const created: { name: string; username: string; pin: string }[] = [];
  const auditRows: string[] = []; // one line per created athlete for the audit log (never includes a PIN)
  let skipped = 0;
  for (const entry of entries) {
    if (existingNames.has(entry.name.toLowerCase())) {
      skipped++;
      continue;
    }
    // First initial + last name ("Alex Rivera" -> "arivera"); a clash gets -2, -3, ...
    const initial = initialLastUsername(entry.name);
    const root = usernameProblem(initial) ? slugifyUsername(entry.name) : initial;
    let username = root;
    let n = 2;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${root}-${n}`;
      n++;
    }
    const pin = randomPin();
    const pinHash = await hashPin(pin);
    await prisma.user.create({
      data: {
        name: entry.name,
        username,
        position: entry.position || null,
        gradYear: entry.gradYear,
        pinHash,
        role: "PLAYER",
      },
    });
    created.push({ name: entry.name, username, pin });
    auditRows.push(`${entry.name} (@${username}${entry.position ? `, ${entry.position}` : ""}${entry.gradYear ? `, class of ${entry.gradYear}` : ""})`);
    existingNames.add(entry.name.toLowerCase());
  }

  await audit(coach, "bulk add athletes", null, `${created.length} created, ${skipped} skipped: ${auditRows.join("; ").slice(0, 8000)}`);
  return NextResponse.json({ created, skipped });
}
