import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import Markdown from "@/components/Markdown";
import PhaseGlance, { type PhaseOverview } from "@/components/PhaseGlance";
import guide from "@/data/player-docs.json";
import overviewData from "@/data/phase-overview.json";

// Athlete Docs: a short program guide (what each phase is and its goal, plus the injury-prevention basics),
// one section per tab, with the same "phase at a glance" card the coach Docs page shows. The design rationale
// stays on the coach-only Docs page. Coaches can open this page too, to see what athletes see.
type Section = { key: string; tab: string; markdown: string };

function sectionsOf(markdown: string): Section[] {
  const parts = markdown.split(/^## /m).slice(1); // drop the title line before the first "## "
  return parts.map((p, i) => {
    const heading = p.split("\n")[0].trim();
    const phase = heading.match(/^(Phase \d)\s+—/);
    return { key: String(i + 1), tab: phase ? phase[1] : heading, markdown: "## " + p };
  });
}

export default async function PlayerDocsPage({ searchParams: searchParamsP }: { searchParams: Promise<{ s?: string }> }) {
  const searchParams = await searchParamsP;
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");
  if (user.mustChangePin) redirect("/change-pin");

  const sections = sectionsOf((guide as { markdown: string }).markdown);
  const current = sections.find((s) => s.key === searchParams.s) ?? sections[0];
  const overviewKey = current.tab.match(/^Phase (\d)$/)?.[1] ?? current.tab;
  const overview = (overviewData as { phases: Record<string, PhaseOverview> }).phases[overviewKey];
  const isCoach = user.role === "COACH";

  return (
    <div>
      <NavBar role={isCoach ? "COACH" : "PLAYER"} name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Program guide</h2>
          <p className="text-sm text-muted mb-3">What each phase of the year is and what it is for.</p>
          {isCoach && (
            <p className="text-xs text-muted mb-3">
              Coach view: this is the athlete version. The full design and rationale are on the coach{" "}
              <Link href="/coach/docs" className="text-accent font-semibold">Docs</Link> page.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <Link
                key={s.key}
                href={`/docs?s=${s.key}`}
                className={`text-sm rounded-md border px-3 py-1.5 ${
                  s.key === current.key ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line"
                }`}
              >
                {s.tab}
              </Link>
            ))}
          </div>
        </div>
        {overview && <PhaseGlance o={overview} />}
        <div className="bg-surface border border-line rounded-xl p-4">
          <Markdown source={current.markdown} />
        </div>
      </main>
    </div>
  );
}
