import type { HosanaDatabase } from "./database";

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function getPurgeAt(): string {
  return new Date(Date.now() + TRASH_RETENTION_MS).toISOString();
}

/**
 * Hard-removes trashed records whose purgeAt has expired.
 * doc.remove() writes a local `_deleted` tombstone; replication pushes it
 * to the server, then purges the local row once the push succeeds.
 */
export async function purgeExpiredTrash(db: HosanaDatabase): Promise<void> {
  const nowIso = new Date().toISOString();

  const targets = [
    db.folders,
    db.songs,
    db.collections,
    db.services,
    db.agendaEvents,
  ] as const;

  for (const collection of targets) {
    const expired = await collection
      .find({
        selector: {
          isDeleted: true,
          purgeAt: { $lte: nowIso, $ne: null },
        },
      })
      .exec();

    for (const doc of expired) {
      await doc.remove();
    }
  }
}
