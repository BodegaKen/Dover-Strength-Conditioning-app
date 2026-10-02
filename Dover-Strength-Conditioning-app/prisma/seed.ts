import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
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
  const pin = process.env.COACH_PIN ?? randomPin();

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
      // The coach sets their own PIN up front via env vars, so there's no
      // forced first-login change — flip this to true if you'd rather they
      // pick their own PIN the first time they log in.
      mustChangePin: false,
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
  console.log(`  PIN:      ${pin}`);
  console.log("\nSave this PIN now — it will not be shown again. Log in at /login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
