import { prisma } from "./db";
import { getPeriod } from "./prescription";
import { buildPlanDays, dayProgress, type TrainingTrack, type PullupMode } from "./plan";
import { LIFT_LABEL } from "./calc";
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
  for (const t of tests) {
    (out[t.date] ??= []).push({
      kind: "test",
      label: `${LIFT_LABEL[t.lift] ?? t.lift} max test`,
      complete: true,
      done: 1,
      total: 1,
      sets: [],
      detail: `5RM ${t.fiveRM} → e1RM ${t.e1RM}`,
    });
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
    lift: LIFT_LABEL[lift] ?? lift,
    text: ss
      .map((s) => {
        const bo = s.setNumber > 100 ? " (back-off)" : "";
        if (s.weight != null) return `${s.weight}${s.reps != null ? `×${s.reps}` : ""}${bo}`;
        return `${s.reps ?? "?"} reps${bo}`;
      })
      .join(", "),
  }));
}
