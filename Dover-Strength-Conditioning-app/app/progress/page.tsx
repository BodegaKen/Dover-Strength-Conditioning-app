import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TestEntryRecord } from "@/lib/types";
import NavBar from "@/components/NavBar";
import ProgressCharts from "./ProgressCharts";

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");

  const tests: TestEntryRecord[] = await prisma.testEntry.findMany({
    where: { athleteId: user.id },
    orderBy: { date: "asc" },
  });

  return (
    <div>
      <NavBar role="PLAYER" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5">
        <ProgressCharts
          tests={tests.map((t: TestEntryRecord) => ({ date: t.date, lift: t.lift, e1RM: t.e1RM }))}
        />
      </main>
    </div>
  );
}
