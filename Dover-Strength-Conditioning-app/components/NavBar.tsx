"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar({ role, name }: { role: "PLAYER" | "COACH"; name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const links =
    role === "COACH"
      ? [
          { href: "/coach", label: "Coach" },
          { href: "/leaderboard", label: "Leaderboard" },
        ]
      : [
          { href: "/dashboard", label: "This Week" },
          { href: "/progress", label: "Progress" },
          { href: "/leaderboard", label: "Leaderboard" },
        ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-20 bg-surface border-b-[3px] border-accent">
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <div className="text-[0.72rem] tracking-[0.14em] text-accent font-display font-semibold">
          Dover Tigers Football &middot; Strength &amp; Conditioning
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl">{name}</h1>
          <button
            onClick={logout}
            className="text-xs uppercase tracking-wide border border-line rounded-md px-3 py-1.5 text-fg/80 hover:border-accent"
          >
            Log out
          </button>
        </div>
        <nav className="flex gap-1 mt-3 border-t border-line -mb-px">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex-1 text-center font-display uppercase text-sm tracking-wide py-2.5 border-b-[3px] -mb-px ${
                  active ? "border-accent text-fg" : "border-transparent text-muted"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
