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

  const { folders, songs, services, agendaEvents } = generateDemoData(locale);

  // Bulk-insert each collection, skipping docs that already exist.
  await Promise.all([
    ...folders.map((doc) =>
      db.folders.upsert(doc as any).catch(() => {
        /* already exists — ignore */
      }),
    ),
    ...songs.map((doc) =>
      db.songs.upsert(doc as any).catch(() => {
        /* already exists — ignore */
      }),
    ),
    ...services.map((doc) =>
      db.services.upsert(doc as any).catch(() => {
        /* already exists — ignore */
      }),
    ),
    ...agendaEvents.map((doc) => {
      return db.agendaEvents.upsert(doc as any).catch(() => {
        /* already exists — ignore */
      });
    }),
  ]);

  markDemoSeeded();
}
