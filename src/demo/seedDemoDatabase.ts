/**
 * Demo Mode — database seeder.
 *
 * Inserts all generated demo documents into the RxDB collections.
 * Safe to call multiple times in the same session — idempotent via
 * the `demo_seeded` sessionStorage flag.
 */

import type { HosanaDatabase } from "../db/database";
import { generateDemoData } from "./demoData";
import { isDemoSeeded, markDemoSeeded } from "./index";

/**
 * Hydrates the local RxDB database with demo data.
 *
 * @param db     The live HosanaDatabase instance.
 * @param locale Browser locale string (e.g. "pt-BR", "en-US", "es").
 */
export async function seedDemoDatabase(
  db: HosanaDatabase,
  locale: string,
): Promise<void> {
  if (isDemoSeeded()) return;

  const { folders, songs, collections, services, agendaEvents } =
    generateDemoData(locale);

  const upsertDoc = <T extends { id: string }>(
    collection: { upsert: (doc: T) => Promise<unknown> },
    doc: T,
  ) =>
    collection.upsert(doc).catch(() => {
      /* already exists — ignore */
    });

  // Bulk-insert each collection, skipping docs that already exist.
  await Promise.all([
    ...folders.map((doc) => upsertDoc(db.folders, doc)),
    ...songs.map((doc) => upsertDoc(db.songs, doc)),
    ...collections.map((doc) => upsertDoc(db.collections, doc)),
    ...services.map((doc) => upsertDoc(db.services, doc)),
    ...agendaEvents.map((doc) => upsertDoc(db.agendaEvents, doc)),
  ]);

  markDemoSeeded();
}
