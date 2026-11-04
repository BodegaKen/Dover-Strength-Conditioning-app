import { redirect } from "next/navigation";
import Link from "next/link";
import { getCoachPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import NavBar from "@/components/NavBar";
import ProfileForm from "./ProfileForm";

// Any coach: edit your own display name. Your sign-in username and PIN do not change.
export default async function CoachProfilePage() {
  const coach = await getCoachPage();
  if (!coach) redirect("/dashboard");
  const user = await prisma.user.findUnique({ where: { id: coach.id }, select: { name: true, username: true } });
  if (!user) redirect("/login");

  return (
    <div>
      <NavBar role="COACH" name={user.name} />
      <main className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <Link href="/coach" className="text-sm text-accent font-semibold">
          &larr; Back to Coach dashboard
        </Link>
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Your profile</h2>
          <p className="text-sm text-muted mb-4">
            This is the name athletes and coaches see. Changing it does not change your PIN or how you sign in.
          </p>
          <ProfileForm initialName={user.name} username={user.username} />
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <h2 className="text-lg mb-1">Lifting calendar</h2>
          <p className="text-sm text-muted mb-3">
            The Dover Public Schools 2026-27 district calendar with the lifting phases outlined (Phase 0 through Phase 3 and the
            Phase 2-3 Bridge), plus a key page. Phase 4 and the blackout week are not shaded because their dates are not set yet.
            Last updated Nov 4, 2026.
          </p>
          <a
            href="/coach/lifting-calendar-2026-27.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5"
          >
            Open calendar (PDF)
          </a>
        </div>
      </main>
    </div>
  );
}
