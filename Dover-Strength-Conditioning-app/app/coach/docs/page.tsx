import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import NavBar from "@/components/NavBar";
import Markdown from "@/components/Markdown";
import PhaseGlance, { type PhaseOverview } from "@/components/PhaseGlance";
import docsData from "@/data/coaching-docs.json";
import overviewData from "@/data/phase-overview.json";

type Doc = { key: string; title: string; markdown: string };
type Section = { key: string; tab: string; markdown: string };

// Coach-only: Program Design and Rationale (sections 1-9; the compliance and open-items sections and the
// revision notes are left out on purpose), a snapshot copied from the program documents, shown one section
// per tab so each phase opens on its own. Athletes never see this page (middleware and the check below
// both require a coach).
function sectionsOf(markdown: string): Section[] {
  const parts = markdown.split(/^## /m).slice(1); // drop the title line before the first "## "
  return parts.map((p, i) => {
    const heading = p.split("\n")[0].trim();
    const m = heading.match(/^(\d+)\.\s*(.*)$/);
    const rest = m ? m[2] : heading;
    // Tab label: "Phase 3" for phase sections, otherwise the plain section name.
    const phase = rest.match(/^(Phase \d)/);
    const tab = phase ? phase[1] : rest.replace(/&.*$/, "").replace(/^Program /, "").trim();
    return { key: String(i + 1), tab, markdown: "## " + p };
  });
}

export default async function CoachDocsPage({ searchParams }: { searchParams: { s?: string } }) {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");

  const data = docsData as { docs: Doc[]; updated: string };
  const sections = sectionsOf(data.docs[0].markdown);
  const current = sections.find((s) => s.key === searchParams.s) ?? sections[0];
  // Phase tabs ("Phase 3") get a dates + typical-week card above the section text.
  const phaseNum = current.tab.match(/^Phase (\d)$/)?.[1];
  const overview = phaseNum ? (overviewData as { phases: Record<string, PhaseOverview> }).phases[phaseNum] : undefined;

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Program Design and Rationale</h2>
          <p className="text-sm text-muted mb-3">
            What each phase is, why it is built the way it is, and how it is set up.
          </p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <Link
                key={s.key}
                href={`/coach/docs?s=${s.key}`}
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
