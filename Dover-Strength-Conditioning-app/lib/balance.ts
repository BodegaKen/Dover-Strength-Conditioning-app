// "Imbalances" = how a player's tested lifts compare with each other and with
// their own history. Deliberately descriptive: a search for published
// lift-to-lift ratio standards found nothing validated for high-school
// football players (only small adult/elite samples and gym-lore tables), so
// this module never labels an individual ratio "good" or "bad". The coach view
// can flag players who sit far from the *team's own median*, which is a
// conversation starter, not a diagnosis.

export type E1 = Record<string, number | undefined>;

export type RatioDef = { key: string; label: string; num: string; den: string | "bw"; hint: string };

export const RATIOS: RatioDef[] = [
  { key: "bench_squat", label: "Bench ÷ Squat", num: "bench", den: "squat", hint: "Upper vs. lower body" },
  { key: "dead_squat", label: "Deadlift ÷ Squat", num: "deadlift", den: "squat", hint: "Hinge vs. squat" },
  { key: "ohp_bench", label: "Overhead Press ÷ Bench", num: "ohp", den: "bench", hint: "Vertical vs. horizontal press" },
  { key: "squat_bw", label: "Squat ÷ Bodyweight", num: "squat", den: "bw", hint: "Relative lower-body strength" },
  { key: "bench_bw", label: "Bench ÷ Bodyweight", num: "bench", den: "bw", hint: "Relative pressing strength" },
  { key: "dead_bw", label: "Deadlift ÷ Bodyweight", num: "deadlift", den: "bw", hint: "Relative pulling strength" },
];

export function ratioValue(def: RatioDef, e1: E1, bodyweight: number | null | undefined): number | null {
  const n = e1[def.num];
  const d = def.den === "bw" ? bodyweight ?? undefined : e1[def.den];
  if (n == null || d == null || !(d > 0)) return null;
  return n / d;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Team-outlier rule (coach view only): needs at least this many athletes with
// the ratio, and a player is flagged when they sit this far (relative) from the median.
export const MIN_TEAM_N = 5;
export const OUTLIER_PCT = 0.15;

export type TeamMedians = Record<string, { median: number; n: number } | undefined>;

export function teamMedians(athletes: { e1: E1; bodyweight: number | null }[]): TeamMedians {
  const out: TeamMedians = {};
  for (const def of RATIOS) {
    const vals = athletes.map((a) => ratioValue(def, a.e1, a.bodyweight)).filter((v): v is number => v != null);
    const m = median(vals);
    if (m != null) out[def.key] = { median: m, n: vals.length };
  }
  return out;
}

export function isOutlier(value: number, med: { median: number; n: number } | undefined): "high" | "low" | null {
  if (!med || med.n < MIN_TEAM_N) return null;
  const diff = (value - med.median) / med.median;
  if (diff >= OUTLIER_PCT) return "high";
  if (diff <= -OUTLIER_PCT) return "low";
  return null;
}

// Change from an athlete's first recorded test to their latest, per lift.
export function trends(tests: { lift: string; e1RM: number; date: string }[]) {
  const by = new Map<string, { e1RM: number; date: string }[]>();
  for (const t of tests) {
    if (!by.has(t.lift)) by.set(t.lift, []);
    by.get(t.lift)!.push(t);
  }
  const out: { lift: string; first: number; latest: number; pct: number; firstDate: string; latestDate: string }[] = [];
  for (const [lift, ts] of by) {
    if (ts.length < 2) continue;
    const s = ts.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const first = s[0];
    const last = s[s.length - 1];
    if (!(first.e1RM > 0)) continue;
    out.push({ lift, first: first.e1RM, latest: last.e1RM, pct: ((last.e1RM - first.e1RM) / first.e1RM) * 100, firstDate: first.date, latestDate: last.date });
  }
  return out;
}
