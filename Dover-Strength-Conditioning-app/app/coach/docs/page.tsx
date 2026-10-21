import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import NavBar from "@/components/NavBar";
import Markdown from "@/components/Markdown";
import docsData from "@/data/coaching-docs.json";

type Doc = { key: string; title: string; markdown: string };

// Coach-only: the five Coaching Copies (Phases 1-5), a snapshot copied from the program documents.
// The Research Report and the athlete-facing posters are deliberately not here. Athletes never see
// this page (middleware and the check below both require a coach).
export default async function CoachDocsPage({ searchParams }: { searchParams: { d?: string } }) {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");

  const docs = (docsData as { docs: Doc[]; updated: string }).docs;
  const current = docs.find((d) => d.key === searchParams.d) ?? docs[0];

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Coaching documents</h2>
          <p className="text-sm text-muted mb-3">
            The five Coaching Copies, as of {(docsData as { updated: string }).updated}. This is a snapshot: if a phase document is
            revised, the app copy has to be refreshed, so check the date and the Project version when in doubt.
          </p>
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <Link
                key={d.key}
                href={`/coach/docs?d=${d.key}`}
                className={`text-sm rounded-md border px-3 py-1.5 ${
                  d.key === current.key ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line"
                }`}
              >
                {d.title}
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <Markdown source={current.markdown} />
        </div>
      </main>
    </div>
  );
}
