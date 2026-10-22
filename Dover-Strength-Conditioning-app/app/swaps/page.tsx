import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import data from "@/data/substitutions.json";

type Row = { item: string; primary: string; swap: string; mainLift: boolean };
type Group = { heading: string; note?: string; rows: Row[] };
type Tab = { key: string; title: string; intro: string; groups: Group[] };

// Equipment substitutions for athletes and coaches: what to do when a station's equipment is taken,
// broken or missing. Generated from the Equipment Substitutions tables in the phase documents
// (data/substitutions.json), so it is a snapshot like the Docs tab.
export default async function SwapsPage({ searchParams }: { searchParams: { t?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect("/login");

  const d = data as { updated: string; tabs: Tab[] };
  const tab = d.tabs.find((t) => t.key === searchParams.t) ?? d.tabs[0];
  const role = user.role === "COACH" ? "COACH" : "PLAYER";

  return (
    <div>
      <NavBar role={role} name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Equipment swaps</h2>
          <p className="text-sm text-muted mb-3">{tab.intro}</p>
          <div className="flex flex-wrap gap-2">
            {d.tabs.map((t) => (
              <Link
                key={t.key}
                href={`/swaps?t=${t.key}`}
                className={`text-sm rounded-md border px-3 py-1.5 ${
                  t.key === tab.key ? "border-accent bg-accent text-accent-ink font-semibold" : "border-line"
                }`}
              >
                {t.title}
              </Link>
            ))}
          </div>
        </div>

        {tab.groups.map((g) => (
          <div key={g.heading} className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2">
            <h3 className="text-base uppercase tracking-wide font-display">{g.heading}</h3>
            {g.note && <div className="text-sm rounded-md border border-warning bg-warning-bg px-3 py-2">{g.note}</div>}
            <ul className="flex flex-col divide-y divide-line border border-line rounded-lg">
              {g.rows.map((r) => (
                <li key={r.item} className="px-3 py-2.5 text-sm flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.item}</span>
                    {r.mainLift && (
                      <span className="text-[0.68rem] uppercase tracking-wide rounded-full px-2 py-0.5 border border-warning bg-warning-bg text-warning">
                        Coach OK first
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">Normally: {r.primary}</div>
                  <div>
                    <span className="text-accent font-semibold">Swap: </span>
                    {r.swap}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-muted">Swaps are coaching conventions, not exact equivalents. As of {d.updated}.</p>
      </main>
    </div>
  );
}
