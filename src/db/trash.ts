import type { HosanaDatabase } from "./database";

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function getPurgeAt(): string {
  return new Date(Date.now() + TRASH_RETENTION_MS).toISOString();
}

/**
 * Hard-removes trashed records whose purgeAt has expired.
 * doc.remove() sets the replication tombstone, which then
 * replicates the permanent deletion to the server.
 */
export async function purgeExpiredTrash(db: HosanaDatabase): Promise<void> {
  const nowIso = new Date().toISOString();

  const collections = [
    db.folders,
    db.songs,
    db.services,
    db.agendaEvents,
  ] as const;

  for (const collection of collections) {
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
