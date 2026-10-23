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

// Display names for coach accounts: whitespace collapsed, 2-80 characters, no control characters or angle brackets.
export function nameProblem(name: string): string | null {
  if (name.length < 2) return "Enter a name (at least 2 characters).";
  if (name.length > 80) return "Keep the name to 80 characters or fewer.";
  if (/[\u0000-\u001f<>]/.test(name)) return "That name has characters that aren't allowed.";
  return null;
}

// Sign-in usernames: lowercase letters, numbers and hyphens, 3-40 characters, no leading or trailing hyphen.
export function usernameProblem(username: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(username)) {
    return "Usernames are 3-40 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen.";
  }
  return null;
}
