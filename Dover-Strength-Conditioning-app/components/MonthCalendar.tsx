import Link from "next/link";
import type { CalendarData } from "@/lib/calendar";
import { summarizeSets } from "@/lib/calendar";
import phaseCal from "../data/phase-calendar.json";

// Planned sessions from data/phase-calendar.json: a colored bar under the date. s = scheduled session,
// t = test or retest week, o = optional session (dashed), c = only if school is open that day (dotted).
// This is a plan layer only: an unlogged planned day is never shown as missed.
type PlanKind = "s" | "t" | "o" | "c";
const PLAN_DAYS = phaseCal.days as unknown as Record<string, [string, PlanKind]>;
const PLAN_PHASES = phaseCal.phases as unknown as Record<string, { label: string; color: string }>;
const BAR_STYLE: Record<PlanKind, string> = { s: "solid", t: "solid", o: "dashed", c: "dotted" };

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function MonthCalendar({
  month,
  data,
  today,
  basePath,
}: {
  month: string; // YYYY-MM
  data: CalendarData;
  today: string;
  basePath: string;
}) {
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthDates = Object.keys(data).filter((d) => d.startsWith(month)).sort();
  const trainedDays = monthDates.filter((d) => data[d].some((e) => e.complete)).length;
  const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const planInMonth = cells.filter((c): c is string => !!c && !!PLAN_DAYS[c]).map((c) => PLAN_DAYS[c]);
  const planPhases = Array.from(new Set(planInMonth.map((p) => p[0])));
  const planKinds = new Set(planInMonth.map((p) => p[1]));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <Link href={`${basePath}?m=${shiftMonth(month, -1)}`} className="text-accent font-semibold px-2">
            &larr;
          </Link>
          <div className="text-center">
            <h2 className="text-lg">{title}</h2>
            <div className="text-xs text-muted">{trainedDays} training day{trainedDays === 1 ? "" : "s"} completed</div>
          </div>
          <Link href={`${basePath}?m=${shiftMonth(month, 1)}`} className="text-accent font-semibold px-2">
            &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] uppercase tracking-wide text-muted mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} />;
            const entries = data[iso] ?? [];
            const complete = entries.some((e) => e.complete);
            const partial = !complete && entries.length > 0;
            const plan = PLAN_DAYS[iso];
            const planPhase = plan ? PLAN_PHASES[plan[0]] : undefined;
            return (
              <div
                key={i}
                title={plan && planPhase ? `${planPhase.label}${plan[1] === "o" ? " (optional)" : plan[1] === "t" ? " (test or retest week)" : plan[1] === "c" ? " (only if school is open)" : ""}` : undefined}
                className={`relative aspect-square rounded-md border flex flex-col items-center justify-center text-sm ${
                  complete
                    ? "border-good bg-good-bg text-good font-bold"
                    : partial
                    ? "border-warning bg-warning-bg text-warning"
                    : "border-line text-muted"
                } ${iso === today ? "ring-2 ring-accent" : ""}`}
              >
                <span className="num leading-none">{Number(iso.slice(8))}</span>
                <span className="leading-none mt-0.5 text-xs">{complete ? "✓" : partial ? "●" : plan && plan[1] === "t" ? "T" : " "}</span>
                {plan && planPhase && (
                  <span
                    className="absolute left-1 right-1 bottom-0.5"
                    style={{ borderTop: `3px ${BAR_STYLE[plan[1]]} ${planPhase.color}` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted">
          <span><span className="text-good font-bold">{"✓"}</span> completed</span>
          <span><span className="text-warning">{"●"}</span> started, not finished</span>
        </div>
        {planPhases.length > 0 && (
          <div className="mt-2 pt-2 border-t border-line flex flex-col gap-1 text-xs text-muted">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {planPhases.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-4" style={{ borderTop: `3px solid ${PLAN_PHASES[k].color}` }} />
                  {PLAN_PHASES[k].label}
                </span>
              ))}
            </div>
            <div>
              Bar = scheduled session{planKinds.has("t") ? "; T = test or retest week" : ""}
              {planKinds.has("o") ? "; dashed bar = optional session" : ""}
              {planKinds.has("c") ? "; dotted bar = only if school is open that day (emergency make-up day)" : ""}. Nothing here counts as
              missed; the green check only comes from what you log.
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {monthDates.length === 0 && <p className="text-sm text-muted">Nothing logged this month yet.</p>}
        {monthDates
          .slice()
          .reverse()
          .map((d) => (
            <div key={d} className="bg-surface border border-line rounded-xl p-4">
              <div className="text-sm font-semibold mb-1.5">{fmtDate(d)}</div>
              <div className="flex flex-col gap-2">
                {data[d].map((e, i) => (
                  <div key={i}>
                    <div className="text-sm">
                      <span className={e.complete ? "text-good font-semibold" : "text-warning"}>{e.complete ? "✓" : "●"}</span>{" "}
                      <span className="font-semibold">{e.label}</span>
                      {!e.complete && (
                        <span className="text-muted"> &middot; {e.done}/{e.total} {e.kind === "test" ? "tests" : "items"}</span>
                      )}
                      {e.detail && <span className="text-muted"> &middot; {e.detail}</span>}
                    </div>
                    {summarizeSets(e.sets).map((s) => (
                      <div key={s.lift} className="text-xs text-muted pl-5 num">
                        {s.lift}: {s.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
