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
      </main>
    </div>
  );
}
