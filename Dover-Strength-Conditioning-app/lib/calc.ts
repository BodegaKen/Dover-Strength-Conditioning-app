// Shared math: the same formulas used throughout the written program
// (e1RM = tested 5RM / 0.87) and the same ACWR methodology from the
// Phase 5 doc / Program Design and Rationale (acute = trailing 7-day
// session-load sum, chronic = trailing 28-day average weekly load).

export function round2_5(n: number): number {
  return Math.round(n / 2.5) * 2.5;
}

export function calcE1RM(fiveRM: number): number {
  return round2_5(fiveRM / 0.87);
}

export function isoDateLocal(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// The team is in Dover, NJ. "Today" is always the Eastern-time date, no
// matter where the code runs: Vercel's servers run on UTC, so without this a
// 9pm Friday workout would be stamped as Saturday.
export const APP_TZ = "America/New_York";

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Monday (ISO yyyy-mm-dd) of the week containing the given date.
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun .. 6 Sat
  return addDaysISO(iso, day === 0 ? -6 : 1 - day);
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDateLocal(d);
}

export type SessionLike = { date: string; load: number };

export type LoadStats = {
  acuteLoad: number;
  chronicAvg: number;
  acwr: number | null;
  monotony: number | null;
  strain: number | null;
  hasData: boolean;
};

export function computeLoadStats(sessions: SessionLike[], today = todayISO()): LoadStats {
  const acuteStart = addDaysISO(today, -6);
  const chronicStart = addDaysISO(today, -27);
  const acute = sessions.filter((s) => s.date >= acuteStart && s.date <= today);
  const chronic = sessions.filter((s) => s.date >= chronicStart && s.date <= today);
  const acuteLoad = acute.reduce((a, s) => a + (s.load || 0), 0);
  const chronicSum = chronic.reduce((a, s) => a + (s.load || 0), 0);
  const chronicAvg = chronicSum / 4;
  const acwr = chronicAvg > 0 ? acuteLoad / chronicAvg : null;

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(addDaysISO(today, -i));
  const daily = days.map((d) =>
    acute.filter((s) => s.date === d).reduce((a, s) => a + (s.load || 0), 0)
  );
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const variance = daily.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / daily.length;
  const sd = Math.sqrt(variance);
  const monotony = sd > 0 ? mean / sd : null;
  const strain = monotony != null ? acuteLoad * monotony : null;

  return { acuteLoad, chronicAvg, acwr, monotony, strain, hasData: chronic.length > 0 };
}

export type AcwrStatus = { label: string; tone: "good" | "warning" | "danger" | "neutral" };

export function acwrStatus(stats: LoadStats): AcwrStatus {
  if (!stats.hasData || stats.acwr == null) return { label: "No data yet", tone: "neutral" };
  if (stats.acwr >= 1.5) return { label: "Danger zone", tone: "danger" };
  if (stats.acwr >= 0.8 && stats.acwr <= 1.3) return { label: "Sweet spot", tone: "good" };
  return { label: "Caution", tone: "warning" };
}

export const RPE_DESC: Record<number, string> = {
  0: "Rest / no exertion",
  1: "Very light",
  2: "Very light",
  3: "Light, technique-only",
  4: "Light",
  5: "Light-moderate",
  6: "Moderate-hard, several reps left",
  7: "Moderate-hard, several reps left",
  8: "Hard, 1-2 reps left",
  9: "Hard, 1-2 reps left",
  10: "Max effort, no reps left",
};

export const LIFTS = [
  { key: "squat", label: "Squat" },
  { key: "bench", label: "Bench Press" },
  { key: "deadlift", label: "Deadlift" },
  { key: "ohp", label: "Overhead Press" },
  { key: "pullup", label: "Weighted Pull-up" },
] as const;

export type LiftKey = (typeof LIFTS)[number]["key"];

export const LIFT_LABEL: Record<string, string> = Object.fromEntries(
  LIFTS.map((l) => [l.key, l.label])
);

export const TOTAL_LIFTS: LiftKey[] = ["squat", "bench", "deadlift", "ohp"];
