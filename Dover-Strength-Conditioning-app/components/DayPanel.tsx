import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { getPeriod, getTrack, type RawLift } from "@/lib/prescription";
import { buildPlanDays, isTestPeriod, type TrainingTrack, type PullupMode, type PlanDay, type PlanSection } from "@/lib/plan";
import { viewOf } from "@/lib/planView";
import { weekInfo, weekForDate, planDayForDate } from "@/lib/schedule";
import { PHASE0_WEEKS } from "@/lib/phase0";
import { LIFTS, weekdayOf } from "@/lib/calc";
import phaseCal from "../data/phase-calendar.json";

// What happens on the day picked in the calendar. Players get that day's session, loggable when it is
// in the week the team is on; anything else (another week, a coach viewing) is read-only. Phases 0-3
// only: in-season weeks follow the game schedule and have no fixed dates.
type PlanKind = "s" | "t" | "o" | "c";
const PLAN_DAYS = phaseCal.days as unknown as Record<string, [string, PlanKind]>;
const PLAN_PHASES = phaseCal.phases as unknown as Record<string, { label: string; color: string }>;
const CLOSED_DAYS = new Set(phaseCal.closed as string[]);
const SINGLE_DAYS = new Set(phaseCal.single as string[]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SECTION_LABEL: Record<PlanSection, string> = { warmup: "Warm-up", main: "Main work", accessory: "Accessory", finisher: "Finisher" };

export type DayPanelUser = {
  id: string;
  position?: string | null;
  trainingTrack?: string | null;
  pullupTrack?: string | null;
  bodyweight?: number | null;
};

// Warm-up parts, tempo runs and other display or check items carry no set x rep count to show.
function hasDose(e: { sets: number; reps: string }): boolean {
  return e.sets > 0 && String(e.reps ?? "").trim() !== "";
}

type LatestMap = Record<string, { e1RM: number; fiveRM: number } | undefined>;

// Read-only copy of a session: everything the athlete sees on This Week (notes, warm-up parts, ramps,
// back-off sets), with their own weights when the day is in the team's current week.
function ReadOnlyDay({ day, latest, bodyweight }: { day: PlanDay; latest: LatestMap; bodyweight?: number | null }) {
  const sections = (["warmup", "main", "accessory", "finisher"] as PlanSection[])
    .map((s) => ({ s, items: day.exercises.filter((e) => e.section === s) }))
    .filter((x) => x.items.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {sections.map(({ s, items }) => (
        <div key={s}>
          <div className="text-xs uppercase tracking-wide font-semibold text-accent mb-1">{SECTION_LABEL[s]}</div>
          {day.notes?.[s] && <p className="text-sm text-muted mb-1.5">{day.notes[s]}</p>}
          <ul className="flex flex-col divide-y divide-line border border-line rounded-lg">
            {items.map((e, i) => {
              const v = viewOf(e, latest, bodyweight);
              return (
                <li key={i} className="px-3 py-2 text-sm">
                  <span className="font-semibold">{e.label}</span>
                  {(hasDose(e) || v.pctLabel) && (
                    <span className="text-muted">
                      {" "}
                      &mdash;{hasDose(e) ? ` ${e.sets} x ${e.reps}${e.unit ? ` ${e.unit}` : ""}` : ""}
                      {v.pctLabel ? ` @ ${v.pctLabel}` : ""}
                    </span>
                  )}
                  {v.target && <span className="num font-semibold"> &rarr; {v.target} lb</span>}
                  {v.ramp && <div className="text-xs text-muted mt-0.5">Ramp: {v.ramp}</div>}
                  {v.backoff && (
                    <div className="text-xs text-muted mt-0.5">
                      Back-off: {v.backoff.sets} x {v.backoff.reps} @ {v.backoff.pctLabel}
                      {v.backoff.target ? ` \u2192 ${v.backoff.target} lb` : ""}
                    </div>
                  )}
                  {e.note && <div className="text-xs text-muted mt-0.5">{e.note}</div>}
                  {e.details && e.details.length > 0 && (
                    <ul className="text-xs text-muted mt-1 list-disc pl-4">
                      {e.details.map((d, di) => (
                        <li key={di}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function DayPanel({ iso, user }: { iso: string; user: DayPanelUser | null }) {
  const weekday = weekdayOf(iso);
  const dateLabel = new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const plan = PLAN_DAYS[iso];
  const planPhase = plan ? PLAN_PHASES[plan[0]] : undefined;
  const closed = CLOSED_DAYS.has(iso);
  const single = SINGLE_DAYS.has(iso);
  const at = weekForDate(iso);
  const dayName = at ? planDayForDate(iso, weekday) : null;
  const info = at ? weekInfo(at.trackKey, at.week) : null;
  const dayNote = at ? info?.dayNotes?.[dayName ?? weekday] : undefined;

  let heading: string | null = null;
  let body: ReactNode = null;

  if (at) {
    const track = getTrack(at.trackKey);
    const period = getPeriod(at.trackKey, at.week);
    heading = `${track?.name ?? at.trackKey} · ${period?.label ?? `Week ${at.week}`}`;

    if (at.trackKey === "phase0") {
      const w = PHASE0_WEEKS[at.week - 1];
      const label = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8))}`;
      const d = w?.days.find((x) => x.day.endsWith(label));
      body = d ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Optional Pre-Testing Prep session. Display-only: nothing to log here.</p>
          {d.blocks.map((b, bi) => (
            <div key={bi} className="flex flex-col gap-1.5">
              <div className="text-xs uppercase tracking-wide font-semibold text-accent">{b.heading}</div>
              <ul className="flex flex-col divide-y divide-line border border-line rounded-lg">
                {b.items.map((it, ii) => (
                  <li key={ii} className="px-3 py-2 text-sm">
                    <span className="font-semibold">{it.name}</span>
                    {it.detail && <span className="text-muted"> &mdash; {it.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No Pre-Testing Prep session on this date.</p>
      );
    } else if (isTestPeriod(period)) {
      const lifts = LIFTS.map((l) => ({ label: l.label, lift: period?.lifts?.[l.key] as RawLift | undefined })).filter(
        (x) => x.lift && x.lift.day === weekday
      );
      body =
        lifts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-line border border-line rounded-lg">
              {lifts.map((x) => (
                <li key={x.label} className="px-3 py-2 text-sm">
                  <span className="font-semibold">{x.label}</span>
                  <span className="text-muted"> &mdash; {x.lift?.mode === "retest" ? "retest" : "max test"}</span>
                </li>
              ))}
            </ul>
            {user && (
              <p className="text-sm text-muted">
                Log your max on the <Link href="/dashboard" className="text-accent font-semibold">This Week</Link> page.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">No test is scheduled on this date.</p>
        );
    } else if (dayName) {
      const planDays = buildPlanDays({
        trackKey: at.trackKey,
        period,
        variant: (user?.trainingTrack ?? "FULL") as TrainingTrack,
        pullupMode: (user?.pullupTrack ?? "BODYWEIGHT") as PullupMode,
        position: user?.position,
      }).filter((d) => !d.isTest);
      const day = planDays.find((d) => d.day === dayName);
      if (!day) {
        body = <p className="text-sm text-muted">No barbell session is scheduled on this date.</p>;
      } else {
        const state = user ? await prisma.programState.findUnique({ where: { id: "current" } }) : null;
        const active = (state?.trackKey ?? "phase1") === at.trackKey && (state?.week ?? 1) === at.week;
        // Weights only when the day is in the team's current week; later phases run off later maxes.
        const latest: LatestMap = {};
        if (user && active) {
          const tests = await prisma.testEntry.findMany({ where: { athleteId: user.id }, orderBy: { date: "desc" } });
          for (const t of tests) if (!latest[t.lift]) latest[t.lift] = t;
        }
        body = (
          <div className="flex flex-col gap-2">
            <ReadOnlyDay day={day} latest={latest} bodyweight={user && active ? user.bodyweight : null} />
            <p className="text-xs text-muted">
              {user
                ? active
                  ? "To log this session, use the This Week tab."
                  : "Percentages only. This is not the team's current week; your weights show on This Week when the team gets here."
                : "Percentages of each athlete's tested max. Athletes log on their own This Week tab."}
            </p>
          </div>
        );
      }
    }
  }

  const school = closed ? "No school" : single ? "Single-session day" : null;

  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base">{dateLabel}</h3>
          {school && (
            <span
              className="text-xs rounded-full px-2.5 py-0.5 border"
              style={{
                borderColor: closed ? "rgba(220, 90, 90, 0.7)" : "rgba(230, 190, 40, 0.8)",
                backgroundColor: closed ? "rgba(220, 90, 90, 0.2)" : "rgba(230, 190, 40, 0.25)",
              }}
            >
              {school}
            </span>
          )}
        </div>
        {heading && <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold mt-0.5">{heading}</div>}
        {!heading && planPhase && (
          <div className="text-xs uppercase tracking-wide text-accent font-display font-semibold mt-0.5">
            {planPhase.label}
            {plan[1] === "o" ? " · optional session" : plan[1] === "c" ? " · only if school is open" : plan[1] === "t" ? " · test or retest week" : ""}
          </div>
        )}
      </div>
      {info?.note && <p className="text-sm">{info.note}</p>}
      {dayNote && <div className="text-sm rounded-md border border-warning bg-warning-bg px-3 py-2">{dayNote}</div>}
      {body}
      {!at && (
        <p className="text-sm text-muted">
          {plan
            ? "This date is in the plan, but its session isn't broken out by date here."
            : "Nothing is scheduled in the plan for this date."}
          {user && (
            <>
              {" "}
              Your current week&rsquo;s workout is on <Link href="/dashboard" className="text-accent font-semibold">This Week</Link>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
