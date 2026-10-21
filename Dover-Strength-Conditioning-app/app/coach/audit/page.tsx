import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";

// Full admins only: who changed what on the coach pages (most recent 300).
export default async function AuditPage() {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");
  if (!coach.isAdmin) redirect("/coach");

  const rows = await prisma.auditLog
    .findMany({ orderBy: { at: "desc" }, take: 300 })
    .catch(() => null); // table missing until `prisma db push` has been run

  return (
    <div>
      <NavBar role="COACH" name={coach.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <Link href="/coach" className="text-sm text-accent font-semibold">
          &larr; Back to Coach dashboard
        </Link>
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Coach audit log</h2>
          <p className="text-sm text-muted mb-3">
            Adding or removing accounts, PIN resets, roster edits, edited or deleted test and session entries, and team
            phase/week changes. Attendance marks and set logging are not recorded here. Times are Eastern.
          </p>
          {rows == null ? (
            <p className="text-sm text-danger">The audit table doesn&rsquo;t exist yet. Run `npx prisma db push` once.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-muted uppercase text-xs tracking-wide">
                    <th className="py-1.5 pr-3">When</th>
                    <th className="py-1.5 pr-3">Coach</th>
                    <th className="py-1.5 pr-3">Action</th>
                    <th className="py-1.5 pr-3">About</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap num">
                        {new Intl.DateTimeFormat("en-US", {
                          timeZone: "America/New_York",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(r.at)}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{r.actorName}</td>
                      <td className="py-1.5 pr-3">{r.action}</td>
                      <td className="py-1.5 pr-3 text-muted">
                        {[r.targetName, r.detail].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
