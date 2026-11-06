/**
 * Organization scope for the local-first IndexedDB.
 *
 * The main data stores (songs/folders/…) are shared across workspaces on a
 * single device. This module keeps a durable record of which org slug that
 * data belongs to, and wipes everything when the active slug changes so
 * Org A rows can never leak into Org B (sync alone cannot remove them).
 */

import { isDemoMode } from "../demo/flags";
import type { HosanaDatabase } from "./database";
import { idbDelete, idbGet, idbPut } from "./engine/idb";

export const META_STORE = "meta";
export const META_ORG_SLUG_KEY = "orgSlug";

export interface MetaRow {
  key: string;
  value: string;
}

export interface OrgScopeResult {
  /** True when local data is scoped to `orgSlug` and sync is allowed. */
  matched: boolean;
  /** True when collections / replication state were wiped. */
  cleared: boolean;
}

function getIdb(db: HosanaDatabase): IDBDatabase {
  return db._idb;
}

function hasLocalDocs(db: HosanaDatabase): boolean {
  return (
    db.songs.getAllRaw().length +
      db.folders.getAllRaw().length +
      db.collections.getAllRaw().length +
      db.services.getAllRaw().length +
      db.agendaEvents.getAllRaw().length >
    0
  );
}

/** Read the org slug currently stamped onto local IDB data (if any). */
export async function getLocalOrgSlug(
  db: HosanaDatabase,
): Promise<string | null> {
  try {
    const row = await idbGet<MetaRow>(
      getIdb(db),
      META_STORE,
      META_ORG_SLUG_KEY,
    );
    const value = row?.value?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

async function setLocalOrgSlug(
  db: HosanaDatabase,
  orgSlug: string,
): Promise<void> {
  await idbPut<MetaRow>(getIdb(db), META_STORE, {
    key: META_ORG_SLUG_KEY,
    value: orgSlug,
  });
}

/**
 * Wipe every domain collection. Does not touch the meta store — callers set
 * the new slug after clearing.
 */
export async function clearAllLocalCollections(
  db: HosanaDatabase,
): Promise<void> {
  await Promise.all([
    db.songs.remove(),
    db.folders.remove(),
    db.collections.remove(),
    db.services.remove(),
    db.agendaEvents.remove(),
  ]);
}

/**
 * Ensure local IDB data belongs to `orgSlug`.
 *
 * - Matching slug → no-op, sync allowed.
 * - Different / missing slug (with or without leftover docs) → delete all
 *   local collections + replication state, stamp the new slug.
 * - No active org → clear leftovers and refuse sync (`matched: false`).
 * - Demo mode → skip (demo uses a separate IDB name).
 */
export async function ensureOrgScopedData(
  db: HosanaDatabase,
  orgSlug: string | null | undefined,
): Promise<OrgScopeResult> {
  if (isDemoMode()) {
    return { matched: true, cleared: false };
  }

  const normalized = orgSlug?.trim() || null;
  const stored = await getLocalOrgSlug(db);

  if (!normalized) {
    if (stored !== null || hasLocalDocs(db)) {
      const { clearReplicationState } = await import("./replication");
      await clearAllLocalCollections(db);
      await clearReplicationState();
      // Leave meta empty — there is no active org to stamp.
      try {
        await idbDelete(getIdb(db), META_STORE, META_ORG_SLUG_KEY);
      } catch {
        // non-fatal
      }
      return { matched: false, cleared: true };
    }
    return { matched: false, cleared: false };
  }

  if (stored === normalized) {
    return { matched: true, cleared: false };
  }

  // Slug mismatch (or first bind onto orphan data) — never sync across orgs.
  console.warn(
    `[hosana-db] org slug mismatch (stored=${stored ?? "∅"}, active=${normalized}) — clearing local data`,
  );

  const { clearReplicationState } = await import("./replication");
  await clearAllLocalCollections(db);
  await clearReplicationState();
  await setLocalOrgSlug(db, normalized);

  return { matched: true, cleared: true };
}

/**
 * Defense-in-depth gate used by replication: refuse to push/pull when the
 * durable local slug does not match the active workspace.
 */
export async function orgScopeAllowsSync(
  db: HosanaDatabase,
  orgSlug: string | null | undefined,
): Promise<boolean> {
  if (isDemoMode()) return true;
  const normalized = orgSlug?.trim() || null;
  if (!normalized) return false;
  const stored = await getLocalOrgSlug(db);
  return stored === normalized;
}
