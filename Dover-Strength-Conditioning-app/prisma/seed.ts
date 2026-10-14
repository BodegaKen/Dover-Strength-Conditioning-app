import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

function randomPin(): string {
  return String(randomInt(1000, 10000));
}

function slugifyUsername(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "coach"
  );
}

async function main() {
  const name = process.env.COACH_NAME ?? "Coach Quinones";
  const username = process.env.COACH_USERNAME ?? slugifyUsername(name);
  const suppliedPin = process.env.COACH_PIN;
  const pin = suppliedPin ?? randomPin();

  const existing = await prisma.user.findFirst({ where: { role: "COACH" } });
  if (existing) {
    console.log(`A coach account already exists (@${existing.username}) — skipping seed.`);
    console.log("To add another coach, use the Roster Admin inside the app, or delete the existing coach row first.");
    return;
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const coach = await prisma.user.create({
    data: {
      name,
      username,
      pinHash,
      role: "COACH",
      active: true,
      // A PIN supplied through COACH_PIN is the coach's own choice, so no forced
      // change. A generated PIN is printed once below, so it must be changed at
      // first login.
      mustChangePin: !suppliedPin,
    },
  });

  await prisma.programState.upsert({
    where: { id: "current" },
    update: {},
    create: { id: "current", trackKey: "phase1", week: 1 },
  });

  console.log("Coach account created:");
  console.log(`  name:     ${coach.name}`);
  console.log(`  username: ${coach.username}`);
  if (suppliedPin) {
    console.log("  PIN:      (the COACH_PIN you supplied; not printed)");
    console.log("\nLog in at /login.");
  } else {
    console.log(`  PIN:      ${pin}`);
    console.log("\nSave this PIN now — it will not be shown again, and you must change it at first login. Log in at /login.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
