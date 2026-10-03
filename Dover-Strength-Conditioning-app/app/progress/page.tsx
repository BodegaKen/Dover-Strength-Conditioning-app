import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TestEntryRecord } from "@/lib/types";
import NavBar from "@/components/NavBar";
import ProgressCharts from "./ProgressCharts";
import BalanceCard from "@/components/BalanceCard";

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");

  const tests: TestEntryRecord[] = await prisma.testEntry.findMany({
    where: { athleteId: user.id },
    orderBy: { date: "asc" },
  });

  const latest: Record<string, number> = {};
  for (const t of tests) latest[t.lift] = t.e1RM; // tests are sorted oldest -> newest, so the last one wins

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
        <ProgressCharts
          tests={tests.map((t: TestEntryRecord) => ({ date: t.date, lift: t.lift, e1RM: t.e1RM }))}
        />
        <BalanceCard
          e1={latest}
          bodyweight={user.bodyweight}
          tests={tests.map((t: TestEntryRecord) => ({ lift: t.lift, e1RM: t.e1RM, date: t.date }))}
        />
      </main>
    </div>
  );
}
