import { prisma } from "./db";

// Writes one line to the coach audit log. Never throws: a logging problem (for example the
// table not existing yet before `prisma db push`) must not block the action being logged.
export async function audit(
  actor: { id: string; name: string },
  action: string,
  targetName?: string | null,
  detail?: string | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { actorId: actor.id, actorName: actor.name, action, targetName: targetName ?? null, detail: detail ?? null },
    });
    // Keep the table small: entries older than a year are deleted as new ones are written.
    await prisma.auditLog.deleteMany({ where: { at: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } });
  } catch {
    /* intentionally ignored */
  }
}
