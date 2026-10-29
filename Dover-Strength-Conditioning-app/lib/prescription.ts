import programData from "@/data/program-data.json";
import { round2_5 } from "./calc";
import { PHASE0_WEEKS } from "./phase0";

export type RawLift = {
  sets?: number | string;
  reps?: number | string;
  pctE1RM?: number | string | null;
  mode?: string;
  day?: string;
  note?: string;
  scheme?: string;
  powerLaneCAT?: { sets?: number | string; reps?: number | string; pctE1RM?: number | string | null; note?: string };
  backoff?: { sets?: number | string; reps?: number | string; pctE1RM?: number | string | null };
  // Pull-up only: structured version of the prose in `scheme`, one per track.
  weightedPlan?: { sets: number; reps: string; pctE1RM?: number; atTestedWeight?: boolean };
  bodyweightPlan?: { sets: number; reps: string };
};

export type Period = {
  index: number; // 1-based position within the track
  label: string;
  dateHint?: string;
  lifts: Record<string, RawLift>;
};

export type Track = {
  key: string;
  name: string;
  periods: Period[];
  notEncoded?: string[];
  trailingNote?: string; // e.g. the in-season track's (key phase5, shown as Phase 4) Monday auto-regulation note, shown on every period
};

const root = (programData as any).liftPrescriptionProgram;

function buildPhaseTrack(phase: any): Track {
  return {
    key: phase.key,
    name: phase.name,
    notEncoded: phase.notEncoded,
    periods: phase.weeks.map((w: any, i: number) => ({
      index: i + 1,
      label: w.label ?? `Week ${w.week ?? i + 1}`,
      lifts: w.lifts,
    })),
  };
}

function buildBridgeTrack(bridge: any): Track {
  const source = bridge.weeks ?? bridge.sessions ?? [];
  return {
    key: bridge.key,
    name: bridge.name,
    notEncoded: bridge.notEncoded,
    periods: source.map((w: any, i: number) => ({
      index: i + 1,
      label: w.label ?? `Session ${i + 1}`,
      dateHint: w.date,
      lifts: w.lifts,
    })),
  };
}

function buildPhase5Track(p5: any): Track {
  const ramp = p5.reentryRamp ?? [];
  const periods: Period[] = ramp.map((r: any, i: number) => ({
    index: i + 1,
    label: `Week ${r.weekOfSeason} of season (re-entry ramp)`,
    // The Week 3+ entry only restates Squat and Deadlift (their ramp ends); Bench and Pull-up are
    // unchanged from steady state, so any lift the entry leaves out falls back to steadyState.
    lifts: {
      squat: r.squat ?? p5.steadyState?.squat,
      bench: r.bench ?? p5.steadyState?.bench,
      deadlift: r.deadlift ?? p5.steadyState?.deadlift,
      ohp: r.ohp ?? p5.steadyState?.ohp,
      pullup: r.pullup ?? p5.steadyState?.pullup,
    },
  }));
  // Index 3 and onward: steady state (same lifts object reused for every later week).
  periods.push({
    index: ramp.length + 1,
    label: `Week ${ramp.length + 1}+ of season (steady state)`,
    lifts: p5.steadyState,
  });
  return {
    key: p5.key,
    name: p5.name,
    notEncoded: p5.notEncoded,
    trailingNote: p5.mondayAutoRegulationNote,
    periods,
  };
}

// Phase 0 is display-only: periods exist so the coach can select a week, but there are no lifts.
function buildPhase0Track(): Track {
  return {
    key: "phase0",
    name: "Phase 0 - Transition & Pre-Testing Prep",
    periods: PHASE0_WEEKS.map((w, i) => ({ index: i + 1, label: w.label, dateHint: w.dates, lifts: {} })),
  };
}

export function getAllTracks(): Track[] {
  const tracks: Track[] = [];
  for (const phase of root.phases) tracks.push(buildPhaseTrack(phase));
  // Bridges are inserted where they belong chronologically: after Phase 2, after Phase 3 (the Retest Week is its last period).
  const byKey = Object.fromEntries(tracks.map((t) => [t.key, t]));
  const ordered: Track[] = [buildPhase0Track()];
  for (const t of tracks) {
    ordered.push(t);
    if (t.key === "phase2") {
      const b = root.bridges.find((b: any) => b.key === "bridge_2_3");
      if (b) ordered.push(buildBridgeTrack(b));
    }
    if (t.key === "phase3") {
      const b = root.bridges.find((b: any) => b.key === "camp_bridge");
      if (b) ordered.push(buildBridgeTrack(b));
    }
  }
  ordered.push(buildPhase5Track(root.phase5));
  return ordered;
}

export function getTrack(key: string): Track | undefined {
  return getAllTracks().find((t) => t.key === key);
}

export function getPeriod(trackKey: string, index: number): Period | undefined {
  const track = getTrack(trackKey);
  if (!track) return undefined;
  // In-season (key phase5, shown as Phase 4) periods beyond the last one (steady state) all resolve to the last period.
  if (trackKey === "phase5" && index > track.periods.length) {
    return track.periods[track.periods.length - 1];
  }
  return track.periods.find((p) => p.index === index) ?? track.periods[track.periods.length - 1];
}

export type TargetWeight = { low: number; high?: number } | null;

export function computeTargetWeight(e1RM: number, pctE1RM: number | string | null | undefined): TargetWeight {
  if (pctE1RM == null) return null;
  if (typeof pctE1RM === "number") return { low: round2_5(e1RM * (pctE1RM / 100)) };
  const range = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(pctE1RM.trim());
  if (range) {
    return {
      low: round2_5(e1RM * (parseFloat(range[1]) / 100)),
      high: round2_5(e1RM * (parseFloat(range[2]) / 100)),
    };
  }
  return null;
}

export function formatSetsReps(lift: RawLift): string {
  if (lift.sets == null || lift.reps == null) return "";
  return `${lift.sets} x ${lift.reps}`;
}

export function formatPct(pctE1RM: number | string | null | undefined): string {
  if (pctE1RM == null) return "";
  return `${pctE1RM}%`;
}
