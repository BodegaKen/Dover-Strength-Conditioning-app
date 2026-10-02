// Lightweight structural types mirroring prisma/schema.prisma.
//
// These exist so route handlers and pages can annotate array-callback
// parameters (map/filter/sort) without implicit-any errors. They're
// structurally compatible with the real generated Prisma model types,
// so once `prisma generate` runs they simply line up with (and get
// superseded in strictness by) the generated types — nothing here
// needs to change.

export type Role = "PLAYER" | "COACH";
export type PullupTrack = "BODYWEIGHT" | "WEIGHTED";

export type AthleteRecord = {
  id: string;
  username: string;
  pinHash: string;
  name: string;
  role: Role;
  position: string | null;
  bodyweight: number | null;
  pullupTrack: PullupTrack;
  active: boolean;
  mustChangePin: boolean;
  createdAt: Date;
};

export type TestEntryRecord = {
  id: string;
  athleteId: string;
  lift: string;
  fiveRM: number;
  e1RM: number;
  date: string;
  enteredAt: Date;
};

export type SessionEntryRecord = {
  id: string;
  athleteId: string;
  type: string;
  date: string;
  rpe: number;
  durationMin: number;
  load: number;
  enteredAt: Date;
};
