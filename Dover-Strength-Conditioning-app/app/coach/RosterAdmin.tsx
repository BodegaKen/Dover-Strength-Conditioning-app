"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Athlete = {
  id: string;
  name: string;
  username: string;
  position: string | null;
  gradYear: number | null;
  bodyweight: number | null;
  pullupTrack: "BODYWEIGHT" | "WEIGHTED";
  trainingTrack: "FULL" | "MULTI_SPORT";
  active: boolean;
};

export default function RosterAdmin({ athletes }: { athletes: Athlete[] }) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [bodyweight, setBodyweight] = useState("");
  const [addResult, setAddResult] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  const list = (showArchived ? athletes.filter((a) => !a.active) : athletes.filter((a) => a.active)).slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  async function addAthlete(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/coach/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, position, gradYear: gradYear || undefined, bodyweight: bodyweight || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddResult(`Added ${data.athlete.name} — username "${data.athlete.username}", PIN ${data.pin}. Give this to them now; it only shows once.`);
      setName("");
      setPosition("");
      setGradYear("");
      setBodyweight("");
      router.refresh();
    } else {
      setAddResult(data.error ?? "Couldn't add that athlete.");
    }
  }

  async function addBulk(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/coach/athletes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: bulkText }),
    });
    const data = await res.json();
    if (res.ok) {
      const lines = data.created.map((c: any) => `${c.name}: ${c.username} / ${c.pin}`).join("\n");
      setBulkResult(
        `Added ${data.created.length}${data.skipped ? `, skipped ${data.skipped} already on the roster` : ""}.` +
          (lines ? `\n\nUsername / PIN for each (shown once — save this list):\n${lines}` : "")
      );
      setBulkText("");
      router.refresh();
    } else {
      setBulkResult(data.error ?? "Nothing to add.");
    }
  }

  async function act(id: string, action: string) {
    const res = await fetch(`/api/coach/athletes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (action === "resetPin" && res.ok) {
      setPinNotice(`New PIN: ${data.pin}. They'll be asked to set their own on next login.`);
    }
    router.refresh();
  }

  async function setField(id: string, patch: Record<string, string>) {
    await fetch(`/api/coach/athletes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ...patch }),
    });
    router.refresh();
  }

  async function del(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    setPendingDelete(null);
    await fetch(`/api/coach/athletes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Roster</h2>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs uppercase tracking-wide border border-line rounded-md px-3 py-1.5"
        >
          {showArchived ? "Show active" : "Show archived"}
        </button>
      </div>
      <p className="text-sm text-muted">
        When a player graduates or leaves, <strong>Archive</strong> them &mdash; they drop off the active
        roster and today&rsquo;s numbers but keep their tests on the all-time Leaderboard forever.{" "}
        <strong>Delete</strong> is only for fixing a mistake; it removes them everywhere, leaderboard included.
      </p>

      <form onSubmit={addAthlete} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Name</label>
          <input
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            required
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Position</label>
          <input
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. LB/RB"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Grad year</label>
          <input
            type="number"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            placeholder="e.g. 2027"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Bodyweight</label>
          <input
            type="number"
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value)}
            placeholder="optional"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5"
        >
          Add athlete
        </button>
      </form>
      {addResult && <div className="text-sm rounded-md border border-line bg-bg px-3 py-2 whitespace-pre-wrap">{addResult}</div>}

      <button
        type="button"
        onClick={() => setBulkOpen((v) => !v)}
        className="text-sm text-accent font-semibold self-start"
      >
        {bulkOpen ? "Hide bulk add" : "Add the whole roster at once →"}
      </button>
      {bulkOpen && (
        <form onSubmit={addBulk} className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            One athlete per line, pasted from Hudl, MaxPreps, a spreadsheet, anywhere. A leading jersey
            number is stripped; a comma, tab, or dash after the name becomes their position; a class
            year anywhere in the line (2027, &lsquo;27, or class of 2027) becomes their graduation year.
          </p>
          <textarea
            className="w-full bg-bg border border-line rounded-md px-3 py-2.5 font-mono text-sm"
            rows={6}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"34 John Smith, LB, 2027\n22 Alex Rivera - RB '26\nChris Lee 2028"}
          />
          <button
            type="submit"
            className="self-start bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md px-5 py-2.5"
          >
            Add all
          </button>
          {bulkResult && (
            <div className="text-sm rounded-md border border-line bg-bg px-3 py-2 whitespace-pre-wrap">{bulkResult}</div>
          )}
        </form>
      )}

      {pinNotice && <div className="text-sm rounded-md border border-line bg-bg px-3 py-2">{pinNotice}</div>}

      {!showArchived && (
        <div className="text-xs text-muted rounded-md border border-line bg-bg px-3 py-2 flex flex-col gap-1">
          <p>
            <span className="text-fg font-semibold">Track</span> &mdash; Multi-Sport (2 days/week, no accessory circuit) is for
            basketball/wrestling in Phase 1 and spring sports in Phase 2. It only changes Phase 1 and 2 weeks, and the player
            sees it on their This Week page. Switch a player any time; sets they already logged keep the track they were
            logged under.
          </p>
          <p>
            <span className="text-fg font-semibold">Position</span> &mdash; in Phase 1, skill positions (anyone recognised as not OL/DL) swap one
            circuit station for the Jump Station. Positions are matched from what&rsquo;s typed (QB, RB, WR, TE, DB, LB, OL, DL&hellip;);
            a blank position gets the standard circuit.
          </p>
        </div>
      )}

      <div className="flex flex-col divide-y divide-line">
        {list.length === 0 && (
          <p className="text-sm text-muted py-2">{showArchived ? "No archived athletes." : "No athletes yet."}</p>
        )}
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <Link href={`/coach/athletes/${a.id}`} className="font-semibold text-sm hover:text-accent hover:underline">
                {a.name}
              </Link>
              <div className="text-xs text-muted">
                @{a.username}
                {a.gradYear ? ` · Class of ${a.gradYear}` : ""}
                {a.position ? ` · ${a.position}` : ""}
                {a.bodyweight ? ` · ${a.bodyweight} lb` : ""}
              </div>
              {!showArchived && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <label className="text-xs text-muted flex items-center gap-1">
                    Track
                    <select
                      className="bg-bg border border-line rounded-md px-1.5 py-1 text-xs text-fg"
                      value={a.trainingTrack}
                      onChange={(e) => setField(a.id, { trainingTrack: e.target.value })}
                    >
                      <option value="FULL">Full (4 days)</option>
                      <option value="MULTI_SPORT">Multi-Sport (2 days)</option>
                    </select>
                  </label>
                  <label className="text-xs text-muted flex items-center gap-1">
                    Pull-ups
                    <select
                      className="bg-bg border border-line rounded-md px-1.5 py-1 text-xs text-fg"
                      value={a.pullupTrack}
                      onChange={(e) => setField(a.id, { pullupTrack: e.target.value })}
                    >
                      <option value="BODYWEIGHT">Bodyweight / assisted</option>
                      <option value="WEIGHTED">Weighted</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {!showArchived && (
                <SmallBtn onClick={() => act(a.id, "resetPin")}>Reset PIN</SmallBtn>
              )}
              <SmallBtn onClick={() => act(a.id, showArchived ? "restore" : "archive")}>
                {showArchived ? "Restore" : "Archive"}
              </SmallBtn>
              <SmallBtn danger onClick={() => del(a.id)}>
                {pendingDelete === a.id ? "Tap again" : "Delete"}
              </SmallBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs uppercase tracking-wide rounded-md px-2.5 py-1.5 border ${
        danger ? "border-danger text-danger" : "border-line"
      }`}
    >
      {children}
    </button>
  );
}
