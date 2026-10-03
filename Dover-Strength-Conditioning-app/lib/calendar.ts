import { prisma } from "./db";
import { getPeriod } from "./prescription";
import { buildPlanDays, dayProgress, labelForKey, type TrainingTrack, type PullupMode } from "./plan";
import { CHECK_KEYS, TIME_KEYS } from "./sessionContent";
import { LIFT_LABEL, mondayOf } from "./calc";
import type { SetLogRecord } from "./types";

export type CalendarSet = { lift: string; setNumber: number; weight: number | null; reps: number | null };

export type CalendarEntry = {
  kind: "day" | "test";
  label: string;
  complete: boolean;
  done: number;
  total: number;
  sets: CalendarSet[];
  detail?: string; // test entries: "5RM 315 -> e1RM 362.5"
};

// ISO date -> things the athlete did that day
export type CalendarData = Record<string, CalendarEntry[]>;

// Rebuilds each logged plan day (trackKey + week + planDay) from the program
// data using the track settings frozen on the rows, so "complete" always
// means what it meant when the athlete logged it, then files it under the
// date it was performed. Max tests are checkmarked on their test date.
export async function getCalendarData(athleteId: string): Promise<CalendarData> {
  const rows: SetLogRecord[] = (await prisma.setLog.findMany({ where: { athleteId } })) as any;
  const tests = await prisma.testEntry.findMany({ where: { athleteId } });
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });

  const groups = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const k = `${r.trackKey}|${r.week}|${r.planDay}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const out: CalendarData = {};
  for (const [, g] of groups) {
    const first = g[0];
    const day = buildPlanDays({
      trackKey: first.trackKey,
      period: getPeriod(first.trackKey, first.week),
      variant: first.variant as TrainingTrack,
      pullupMode: first.pullupMode as PullupMode,
      position: athlete?.position,
    }).find((d) => d.day === first.planDay);
    const progress = day ? dayProgress(day, g) : { done: g.length, total: g.length, complete: false, started: true };
    const date = g.map((r) => r.date as string).sort().pop() as string;
    (out[date] ??= []).push({
      kind: "day",
      label: first.planDay,
      complete: progress.complete,
      done: progress.done,
      total: progress.total,
      sets: g
        .map((r) => ({ lift: r.lift as string, setNumber: r.setNumber as number, weight: r.weight as number | null, reps: r.reps as number | null }))
        .sort((a, b) => a.lift.localeCompare(b.lift) || a.setNumber - b.setNumber),
    });
  }
  // Max tests follow the same rule as training days: a test day only gets a
  // checkmark once every lift scheduled for it is logged that week. Testing
  // Week / Retest Week split the lifts Monday (Squat+Bench), Tuesday
  // (Deadlift+Pull-up) and Friday (Overhead Press). Bodyweight-track
  // athletes test pull-up reps, not a weighted 5RM, so pull-up isn't required
  // of them.
  const needsPullup = athlete?.pullupTrack === "WEIGHTED";
  const TEST_GROUPS: string[][] = [["squat", "bench"], ["deadlift", "pullup"], ["ohp"]];
  for (const group of TEST_GROUPS) {
    const required = group.filter((l) => l !== "pullup" || needsPullup);
    const byWeek = new Map<string, typeof tests>();
    for (const t of tests) {
      if (!group.includes(t.lift)) continue;
      const wk = mondayOf(t.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(t);
    }
    for (const [, ts] of byWeek) {
      const latest = new Map<string, (typeof tests)[number]>();
      for (const t of ts.slice().sort((a, b) => (a.date < b.date ? -1 : 1))) latest.set(t.lift, t);
      const done = required.filter((l) => latest.has(l)).length;
      const date = ts.map((t) => t.date).sort().pop() as string;
      (out[date] ??= []).push({
        kind: "test",
        label: `Max tests: ${group.filter((l) => latest.has(l) || required.includes(l)).map((l) => LIFT_LABEL[l] ?? l).join(" + ")}`,
        complete: required.length > 0 && done >= required.length,
        done,
        total: required.length,
        sets: [],
        detail: Array.from(latest.values())
          .map((t) => `${LIFT_LABEL[t.lift] ?? t.lift} 5RM ${t.fiveRM} \u2192 e1RM ${t.e1RM}`)
          .join("; "),
      });
    }
  }
  return out;
}

export function summarizeSets(sets: CalendarSet[]): { lift: string; text: string }[] {
  const by = new Map<string, CalendarSet[]>();
  for (const s of sets) {
    if (!by.has(s.lift)) by.set(s.lift, []);
    by.get(s.lift)!.push(s);
  }
  return Array.from(by.entries()).map(([lift, ss]) => ({
    lift: labelForKey(lift, LIFT_LABEL),
    text: CHECK_KEYS.has(lift)
      ? "done"
      : ss
          .map((s) => {
            const bo = s.setNumber > 100 ? " (back-off)" : "";
            if (TIME_KEYS.has(lift)) return `${s.reps ?? "?"} sec${bo}`;
            if (s.weight != null) return `${s.weight}${s.reps != null ? `\u00d7${s.reps}` : ""}${bo}`;
            return `${s.reps ?? "?"} reps${bo}`;
          })
          .join(", "),
  }));
}
