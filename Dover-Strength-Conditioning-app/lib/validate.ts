import { LIFTS } from "./calc";

export const LIFT_KEYS: string[] = LIFTS.map((l) => l.key);
export const SESSION_TYPES = ["lift", "practice", "game"];
export const MAX_FIVE_RM = 2000; // lb, same bound the coach edit route already used
export const MAX_SESSION_MIN = 600;

// A real calendar date in yyyy-mm-dd form (rejects 2026-02-31 and similar).
export function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
