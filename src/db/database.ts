/**
 * Hosana Database — replaces RxDB.
 *
 * Uses native IndexedDB directly via the lightweight engine in ./engine/.
 * On first call the DB is opened and all docs are loaded into memory;
 * subsequent calls return the same already-resolved promise (singleton).
 *
 * Public API is intentionally identical to the old RxDB surface so no
 * React code needs to change.
 */

import { parseChordPro } from "@hosanna/chordpro";
import { HosanaCollection } from "./engine/collection";
import { idbGetAll, openIDB } from "./engine/idb";
import type {
  AgendaEventDocType,
  FolderDocType,
  ServiceDocType,
  SongDocType,
} from "./schemas";

// ─── DB version ──────────────────────────────────────────────────────────────
// Bump this number whenever store structure changes (new indexes etc.).
// Old stores are left intact — no migrations needed per the spec.
const DB_NAME = "hosana_idb";
const DB_VERSION = 1;

// ─── Store names ─────────────────────────────────────────────────────────────
const STORE_SONGS = "songs";
const STORE_FOLDERS = "folders";
const STORE_SERVICES = "services";
const STORE_AGENDA = "agendaEvents";

// ─── Typed wrappers that satisfy the AnyDoc constraint ───────────────────────
// HosanaCollection<T> requires T extends AnyDoc = {id:string} & Record<string,unknown>.
// Our doc types have explicit fields but no index signature.
// We cast them to "T & Record<string,unknown>" so TypeScript accepts them as
// AnyDoc while preserving all the named field types on the collection's generic.

type AsSongDoc = SongDocType & Record<string, unknown>;
type AsFolderDoc = FolderDocType & Record<string, unknown>;
type AsServiceDoc = ServiceDocType & Record<string, unknown>;
type AsAgendaDoc = AgendaEventDocType & Record<string, unknown>;

// ─── Public database type ────────────────────────────────────────────────────

export interface HosanaDatabaseCollections {
  songs: HosanaCollection<AsSongDoc>;
  folders: HosanaCollection<AsFolderDoc>;
  services: HosanaCollection<AsServiceDoc>;
  agendaEvents: HosanaCollection<AsAgendaDoc>;
}

export type HosanaDatabase = HosanaDatabaseCollections;

// ─── Automatic Count Calculation Functions ───────────────────────────────────

/**
 * Calculates the number of non-deleted songs belonging to a given folder.
 */
export function calculateFolderSongCount(
  folderId: string,
  songs:
    | Array<Pick<SongDocType, "folderId" | "isDeleted" | "_deleted">>
    | HosanaCollection<AsSongDoc>,
): number {
  const list = Array.isArray(songs) ? songs : songs.getAllRaw();
  return list.filter(
    (s) => s.folderId === folderId && !s.isDeleted && !s._deleted,
  ).length;
}

/**
 * Calculates the number of non-deleted subfolders belonging to a given parent folder.
 */
export function calculateFolderCount(
  folderId: string,
  folders:
    | Array<Pick<FolderDocType, "parentId" | "isDeleted" | "_deleted">>
    | HosanaCollection<AsFolderDoc>,
): number {
  const list = Array.isArray(folders) ? folders : folders.getAllRaw();
  return list.filter(
    (f) => f.parentId === folderId && !f.isDeleted && !f._deleted,
  ).length;
}

/**
 * Recalculates songCount and folderCount for an array of folders using the given songs.
 */
export function recalculateFolderCounts(
  folders: AsFolderDoc[],
  songs: Array<Pick<SongDocType, "folderId" | "isDeleted">>,
): AsFolderDoc[] {
  return folders.map((folder) => ({
    ...folder,
    songCount: calculateFolderSongCount(folder.id, songs),
    folderCount: calculateFolderCount(folder.id, folders),
  }));
}

/**
 * Recalculates and updates songCount and folderCount for a specific folder in the database.
 */
export async function updateFolderCounts(
  db: HosanaDatabase,
  folderId: string,
): Promise<void> {
  const folder = await db.folders.findOne(folderId).exec();
  if (!folder) return;
  await folder.patch({
    songCount: calculateFolderSongCount(folderId, db.songs),
    folderCount: calculateFolderCount(folderId, db.folders),
  });
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let dbPromise: Promise<HosanaDatabase> | null = null;

export async function getDatabase(): Promise<HosanaDatabase> {
  if (!dbPromise) {
    dbPromise = _open();
  }
  return dbPromise;
}

/**
 * Bust the DB singleton so the next `getDatabase()` call reopens IDB fresh.
 * Call this after deleting the IndexedDB (e.g. demo logout / wipe).
 */
export function resetDatabase(): void {
  dbPromise = null;
}

async function _open(): Promise<HosanaDatabase> {
  const idb = await openIDB(DB_NAME, DB_VERSION, (db, oldVersion) => {
    if (oldVersion < 1) {
      const songsStore = db.createObjectStore(STORE_SONGS, { keyPath: "id" });
      songsStore.createIndex("updatedAt", "updatedAt");
      songsStore.createIndex("folderId", "folderId");
      songsStore.createIndex("isDeleted", "isDeleted");
      songsStore.createIndex("path", "path");

      const foldersStore = db.createObjectStore(STORE_FOLDERS, {
        keyPath: "id",
      });
      foldersStore.createIndex("updatedAt", "updatedAt");
      foldersStore.createIndex("isDeleted", "isDeleted");
      foldersStore.createIndex("parentId", "parentId");

      const servicesStore = db.createObjectStore(STORE_SERVICES, {
        keyPath: "id",
      });
      servicesStore.createIndex("updatedAt", "updatedAt");
      servicesStore.createIndex("isDeleted", "isDeleted");
      servicesStore.createIndex("archived", "archived");

      const agendaStore = db.createObjectStore(STORE_AGENDA, { keyPath: "id" });
      agendaStore.createIndex("updatedAt", "updatedAt");
      agendaStore.createIndex("date", "date");
      agendaStore.createIndex("isDeleted", "isDeleted");
    }
  });

  // Hydrate all collections in parallel — single read pass per store
  const [rawSongs, rawFolders, rawServices, rawAgenda] = await Promise.all([
    idbGetAll<AsSongDoc>(idb, STORE_SONGS),
    idbGetAll<AsFolderDoc>(idb, STORE_FOLDERS),
    idbGetAll<AsServiceDoc>(idb, STORE_SERVICES),
    idbGetAll<AsAgendaDoc>(idb, STORE_AGENDA),
  ]);

  // Compute initial counts from the loaded IDB data before collection instantiation
  const initialFolders = recalculateFolderCounts(rawFolders, rawSongs);

  const db: HosanaDatabase = {
    songs: new HosanaCollection<AsSongDoc>(idb, STORE_SONGS, rawSongs, {
      localFields: ["score"],
      computedFields: {
        score: (song) => parseChordPro(song.content).score(),
      },
    }),
    folders: new HosanaCollection<AsFolderDoc>(
      idb,
      STORE_FOLDERS,
      initialFolders,
      {
        localFields: ["songCount", "folderCount"],
      },
    ),
    services: new HosanaCollection<AsServiceDoc>(
      idb,
      STORE_SERVICES,
      rawServices,
    ),
    agendaEvents: new HosanaCollection<AsAgendaDoc>(
      idb,
      STORE_AGENDA,
      rawAgenda,
    ),
  };

  return db;
}
