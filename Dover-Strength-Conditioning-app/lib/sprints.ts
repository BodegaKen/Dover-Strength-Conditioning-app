import { prisma } from "./db";

// Coach-entered, hand-timed speed tests. Times are seconds; one value per athlete per event per day
// (the best attempt that day). The plausible ranges only catch typos (e.g. 48.5 for a 4.85 dash).
export const SPRINT_EVENTS = [
  { key: "dash40", label: "40-yard dash", min: 3.5, max: 9.99 },
  { key: "split10", label: "10 m split", min: 1.0, max: 4.0 },
  { key: "split20", label: "20 m split", min: 2.0, max: 6.0 },
  { key: "shuttle300", label: "300-yard shuttle", min: 40, max: 120 },
] as const;

export type SprintKey = (typeof SPRINT_EVENTS)[number]["key"];

export function sprintEvent(key: string | undefined | null) {
  return SPRINT_EVENTS.find((e) => e.key === key);
}

export function fmtSeconds(n: number): string {
  return n.toFixed(2);
}

// The SprintTest table is created by `prisma db push`; until that has been run on the database, every
// read and write must fail soft instead of taking a page down. Typed loosely on purpose so the app still
// compiles against a Prisma client generated before the model existed.
export function sprintTable(): any {
  return (prisma as any).sprintTest;
}
