// "Phase at a glance" card for the coach Docs page: when the phase starts and ends, a few key
// facts, and what a normal week looks like. Pure display from data/phase-overview.json (a snapshot
// copied from the program documents); nothing here is logged or calculated.

export type GlanceDay = { day: string; kind: "lift" | "hard" | "light" | "rest" | "game"; title: string; lines: string[] };
export type GlanceWeek = { label: string; days: GlanceDay[] };
export type PhaseOverview = {
  name: string;
  dates: string;
  dateNote?: string;
  facts: { label: string; value: string }[];
  keyDates?: string[];
  weeksTitle: string;
  weeks: GlanceWeek[];
  progression?: string[];
};

// Each day type gets a colored edge plus a text tag, so the meaning never depends on color alone.
const KIND: Record<GlanceDay["kind"], { tag: string; edge: string }> = {
  lift: { tag: "Lift", edge: "border-l-accent" },
  hard: { tag: "Hard field day", edge: "border-l-danger" },
  light: { tag: "Light", edge: "border-l-good" },
  game: { tag: "Game", edge: "border-l-warning" },
  rest: { tag: "Open", edge: "border-l-line" },
};

function DayRow({ d, wide }: { d: GlanceDay; wide: boolean }) {
  const k = KIND[d.kind];
  const open = d.kind === "rest";
  return (
    <div className={`flex gap-3 border border-line border-l-4 ${k.edge} rounded-lg px-3 py-2 ${open ? "opacity-70" : ""}`}>
      <div className={`${wide ? "w-[4.5rem]" : "w-10"} shrink-0 pt-0.5 font-display uppercase tracking-wide text-sm`}>{d.day}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{d.title}</span>
          {!open && <span className="text-[0.7rem] uppercase tracking-wide text-muted">{k.tag}</span>}
        </div>
        {d.lines.length > 0 && (
          <ul className="mt-1 text-sm text-muted list-disc pl-4 flex flex-col gap-0.5">
            {d.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function PhaseGlance({ o }: { o: PhaseOverview }) {
  // Day labels are normally "Mon"-style; timeline cards (Camp Bridge) use longer ones, so give them more room.
  const wide = o.weeks.some((w) => w.days.some((d) => d.day.length > 4));
  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">Phase at a glance</div>
        <h2 className="text-lg font-display uppercase tracking-wide">{o.name}</h2>
        <p className="text-base font-semibold mt-1">{o.dates}</p>
        {o.dateNote && <p className="text-sm text-muted mt-0.5">{o.dateNote}</p>}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {o.facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted uppercase text-xs tracking-wide sm:pt-0.5">{f.label}</dt>
            <dd className="mb-1.5 sm:mb-0">{f.value}</dd>
          </div>
        ))}
      </dl>

      {o.keyDates && o.keyDates.length > 0 && (
        <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
          {o.keyDates.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold border-t border-line pt-3">{o.weeksTitle}</h3>
        {o.weeks.map((w) => (
          <div key={w.label} className="flex flex-col gap-2">
            {o.weeks.length > 1 && <div className="text-sm font-semibold text-accent">{w.label}</div>}
            {w.days.map((d, i) => <DayRow key={`${d.day}-${i}`} d={d} wide={wide} />)}
          </div>
        ))}
      </div>

      {o.progression && o.progression.length > 0 && (
        <div>
          <h3 className="text-base font-semibold border-t border-line pt-3 mb-1">How the weeks build</h3>
          <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
            {o.progression.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
