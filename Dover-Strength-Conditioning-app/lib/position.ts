// Free-text position -> lane group. Kept in its own small file (no data imports) so the coach
// profile editor can show a live "reads as" hint without pulling the whole program into the browser.

export type PositionGroup = "LINE" | "SKILL" | "MIXED" | "UNKNOWN";

// Linemen are the only group the written program singles out by name
// (everyone else is "skill positions"). Free-text positions are matched
// loosely; blank / unrecognised means UNKNOWN and gets the standard station.
// A two-way player is classified by BOTH sides of the ball:
//   all linemen tokens (OL/DL)        -> LINE
//   all skill tokens (RB/LB, WR/DB)   -> SKILL
//   one of each (OL/LB, DL/RB)        -> MIXED (alternates by week, see laneFor)
const LINE_TOKENS = ["OL", "OT", "OG", "C", "DL", "DT", "DE", "NT", "NG", "LINE", "LINEMAN", "LINEMEN", "TACKLE", "GUARD", "CENTER", "END"];
const SKILL_TOKENS = [
  "TE", "QB", "RB", "FB", "WR", "DB", "CB", "S", "FS", "SS", "LB", "ILB", "OLB", "MLB", "WLB", "SLB", "ATH", "K", "P", "KR", "PR",
  "BACK", "BACKER", "LINEBACKER", "RECEIVER", "QUARTERBACK", "SAFETY", "CORNERBACK", "CORNER", "RUNNING", "WIDE",
];

export function positionGroup(position: string | null | undefined): PositionGroup {
  let p = (position ?? "").toUpperCase().replace(/[^A-Z]/g, " ").replace(/\s+/g, " ").trim();
  if (!p) return "UNKNOWN";
  // Multi-word names that would otherwise split into a lineman token + a skill token.
  p = p.replace(/TIGHT END/g, "TE").replace(/LINE BACKER/g, "LB");
  const tokens = p.split(" ");
  const isLine = tokens.some((t) => LINE_TOKENS.includes(t));
  const isSkill = tokens.some((t) => SKILL_TOKENS.includes(t));
  if (isLine && isSkill) return "MIXED";
  if (isLine) return "LINE";
  if (isSkill) return "SKILL";
  return "UNKNOWN";
}
