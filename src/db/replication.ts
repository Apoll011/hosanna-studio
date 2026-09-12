/**
 * Hosana HTTP Replication — replaces rxdb/plugins/replication.
 *
 * The server-side HTTP pull/push protocol (endpoints, payloads, checkpoint
 * shape) is completely unchanged. Only the client-side driver that
 * communicates between the server and the local store is rewritten here.
 *
 * Replication strategy:
 *  1. Push FIRST: POST /replication/<collection>/push with locally
 *     changed/deleted docs since last checkpoint. Sends only changed fields
 *     in both newDocumentState and assumedMasterState (id + updatedAt + delta).
 *  2. Pull: GET /replication/<collection>/pull with the last checkpoint.
 *     Documents are merged into the local store using _mergeFromServer(),
 *     which preserves local-only fields and re-runs computed fields.
 *     Deleted docs (server tombstones) are removed from the local store.
 *  3. Conflict resolution: identical to the old implementation —
 *     spurious conflicts (volatile-field drift only) are auto-retried;
 *     real content conflicts surface as server docs.
 *  4. FK ordering: services always pushed/pulled before agendaEvents.
 *
 * Checkpoint resilience:
 *  - Checkpoints are saved in BOTH localStorage AND a dedicated IndexedDB store
 *    ("repl_checkpoints"). On startup the IDB copy is preferred (it survives
 *    Safari ITP / quota eviction that can wipe localStorage). If IDB is empty
 *    but localStorage has a value, it is migrated to IDB. This dual-write
 *    strategy means that even if IDB is accidentally wiped (e.g. during a
 *    browser-initiated storage clear) the localStorage copy can reseed it.
 *
 * IDB-wipe resilience:
 *  - On startup we detect whether IDB appears empty after being previously
 *    populated (via a "population-epoch" flag in localStorage). If all stores
 *    read back 0 rows but the epoch flag says they were populated before, we
 *    trigger an immediate full pull (checkpoint = null) for every collection so
 *    the data is restored before the user sees the UI.
 */

import { getApiClient } from "@/src/api";
import type { HosanaDatabase } from "./database";
import { notify, subscribeLocalChange } from "./engine/bus";
import { HosanaCollection } from "./engine/collection";
import { idbDelete, idbGet, idbPut, openIDB } from "./engine/idb";

// ─── Public types (unchanged interface) ──────────────────────────────────────

export type ReplicationSyncState = "syncing" | "synced" | "offline" | "error";

/** Minimal Subject-like object so SyncContext can subscribe with .subscribe() */
export interface StatusSubject {
  subscribe: (fn: (s: ReplicationSyncState) => void) => {
    unsubscribe: () => void;
  };
  next: (s: ReplicationSyncState) => void;
}

export interface ReplicationManager {
  start: () => void;
  stop: () => void;
  replicateNow: () => Promise<void>;
  status$: StatusSubject;
  getStatus: () => ReplicationSyncState;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface Checkpoint {
  updatedAt: number;
  id: string;
}

type SyncableDoc = {
  id: string;
  updatedAt: string;
  _deleted?: boolean;
};

type CollectionName =
  "songs" | "folders" | "collections" | "services" | "agendaEvents";

const ALL_COLLECTION_NAMES: CollectionName[] = [
  "songs",
  "folders",
  "collections",
  "services",
  "agendaEvents",
];

// ─── Simple status subject ────────────────────────────────────────────────────

function makeStatusSubject(): StatusSubject {
  const listeners = new Set<(s: ReplicationSyncState) => void>();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return { unsubscribe: () => listeners.delete(fn) };
    },
    next(s) {
      for (const fn of Array.from(listeners)) fn(s);
    },
  };
}

// ─── Conflict resolution (identical logic to old implementation) ──────────────

const CONFLICT_RETRY_LIMIT = 3;
const VOLATILE_FIELDS = ["updatedAt", "_rev", "_meta", "_attachments"] as const;

function omitVolatile<T extends Record<string, unknown>>(doc: T): Partial<T> {
  const clone: Partial<T> = { ...doc };
  for (const field of VOLATILE_FIELDS) delete clone[field as keyof T];
  return clone;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

function isSpuriousConflict<T extends SyncableDoc>(
  assumedMasterState: T | undefined,
  serverDoc: T,
): boolean {
  if (!assumedMasterState) return false;
  return deepEqual(omitVolatile(assumedMasterState), omitVolatile(serverDoc));
}

// ─── Push payload helpers ─────────────────────────────────────────────────────

/**
 * Compute the set of fields that differ between `current` and `previous`.
 * Always includes `id` and `updatedAt` so the server can identify the doc
 * and perform conflict detection. If there is no previous state (new doc)
 * we return the full document.
 *
 * For the `assumedMasterState` (what the client believes the server last sent)
 * we also strip volatile fields so the diff is meaningful.
 */
function diffFields<T extends SyncableDoc>(
  current: T & { _deleted: boolean },
  previous: (T & { _deleted: boolean }) | null,
): { id: string; updatedAt: string; _deleted: boolean } & Partial<T> {
  // Always send full doc when there is no baseline
  if (!previous) {
    return { ...current };
  }

  const delta: Record<string, unknown> = {
    id: current.id,
    updatedAt: current.updatedAt,
    _deleted: current._deleted,
  };

  for (const key of Object.keys(current) as (keyof T)[]) {
    if (key === "id" || key === "updatedAt" || key === "_deleted") continue;
    if (!deepEqual(current[key], previous[key])) {
      delta[key as string] = current[key];
    }
  }

  return delta as { id: string; updatedAt: string; _deleted: boolean } &
    Partial<T>;
}

/**
 * Build the assumedMasterState payload for a change row.
 * We send only id, updatedAt, and the fields that the server last sent
 * (i.e. the baseline the client is diffing from). Volatile fields are omitted.
 */
function buildAssumedMasterPayload<T extends SyncableDoc>(
  assumed: (T & { _deleted: boolean }) | null,
): ({ id: string; updatedAt: string } & Partial<T>) | null {
  if (!assumed) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(assumed) as (keyof typeof assumed)[]) {
    if (VOLATILE_FIELDS.includes(key as (typeof VOLATILE_FIELDS)[number]))
      continue;
    out[key as string] = assumed[key];
  }
  return out as { id: string; updatedAt: string } & Partial<T>;
}

interface ChangeRow<T> {
  newDocumentState: { id: string; updatedAt: string; _deleted: boolean } &
    Partial<T>;
  assumedMasterState:
    | ({ id: string; updatedAt: string } & Partial<T>)
    | null;
}

async function pushWithConflictRetry<T extends SyncableDoc>(
  client: ReturnType<typeof getApiClient>,
  collectionName: CollectionName,
  changeRows: ChangeRow<T>[],
): Promise<(T & { _deleted: boolean })[]> {
  let pending = changeRows;
  const realConflicts: (T & { _deleted: boolean })[] = [];

  for (let attempt = 0; attempt <= CONFLICT_RETRY_LIMIT; attempt++) {
    const res = await client.request<{ conflicts?: T[] } | T[]>(
      `/replication/${collectionName}/push`,
      {
        method: "POST",
        body: JSON.stringify({ changeRows: pending }),
      },
    );

    const conflicts = (
      Array.isArray(res) ? res : (res as { conflicts?: T[] })?.conflicts || []
    ).map(
      (doc) =>
        ({ ...doc, _deleted: !!doc._deleted }) as T & { _deleted: boolean },
    );

    if (conflicts.length === 0) break;

    const conflictsById = new Map(conflicts.map((c) => [c.id, c]));
    const retryRows: ChangeRow<T>[] = [];

    for (const row of pending) {
      const serverDoc = conflictsById.get(row.newDocumentState.id);
      if (!serverDoc) continue;

      const canRetry =
        attempt < CONFLICT_RETRY_LIMIT &&
        isSpuriousConflict(
          row.assumedMasterState as T | undefined,
          serverDoc,
        );

      if (canRetry) {
        // Retry with server doc as the new assumed baseline
        retryRows.push({
          newDocumentState: diffFields(
            row.newDocumentState as T & { _deleted: boolean },
            serverDoc,
          ),
          assumedMasterState: buildAssumedMasterPayload<T>(serverDoc),
        });
      } else {
        realConflicts.push(serverDoc);
      }
    }

    if (retryRows.length === 0) break;
    pending = retryRows;
  }

  return realConflicts;
}

// ─── Checkpoint persistence (dual-write: IDB + localStorage) ─────────────────

const CP_KEY = "hosana_repl_checkpoint";
const EPOCH_KEY = "hosana_repl_epoch"; // incremented whenever IDB is confirmed populated

/** IDB database instance for checkpoints (separate from the main data IDB) */
let _cpDb: IDBDatabase | null = null;
const CP_IDB_NAME = "hosana_checkpoints";
const CP_IDB_VERSION = 1;
const CP_STORE = "checkpoints";

/**
 * Open (or return the cached) checkpoint IDB database.
 * This is a tiny dedicated IDB so checkpoints survive even if the main
 * data IDB is wiped by the browser.
 */
async function getCheckpointDb(): Promise<IDBDatabase> {
  if (_cpDb) return _cpDb;
  _cpDb = await openIDB(CP_IDB_NAME, CP_IDB_VERSION, (db, oldVersion) => {
    if (oldVersion < 1) {
      db.createObjectStore(CP_STORE, { keyPath: "collection" });
    }
  });
  return _cpDb;
}

async function loadCheckpoint(
  collectionName: CollectionName,
): Promise<Checkpoint | null> {
  // Try IDB first (more durable)
  try {
    const db = await getCheckpointDb();
    const row = await idbGet<{ collection: string; cp: Checkpoint }>(
      db,
      CP_STORE,
      collectionName,
    );
    if (row?.cp) return row.cp;
  } catch {
    // IDB unavailable — fall through to localStorage
  }

  // Fall back to localStorage (may have been written by an older version)
  try {
    const raw = localStorage.getItem(`${CP_KEY}_${collectionName}`);
    if (raw) {
      const cp = JSON.parse(raw) as Checkpoint;
      // Migrate to IDB so future reads are durable
      void saveCheckpoint(collectionName, cp);
      return cp;
    }
  } catch {
    // localStorage unavailable or corrupted
  }

  return null;
}

async function saveCheckpoint(
  collectionName: CollectionName,
  cp: Checkpoint,
): Promise<void> {
  // Write to IDB (primary)
  try {
    const db = await getCheckpointDb();
    await idbPut(db, CP_STORE, { collection: collectionName, cp });
  } catch {
    // IDB write failed — non-fatal, localStorage is the backup
  }

  // Write to localStorage (backup / legacy compat)
  try {
    localStorage.setItem(`${CP_KEY}_${collectionName}`, JSON.stringify(cp));
  } catch {
    // Storage quota exceeded — non-fatal
  }
}

// ─── IDB-wipe detection ───────────────────────────────────────────────────────

/**
 * Increment (or initialise) the "population epoch" counter in localStorage.
 * Called once after the main IDB is confirmed to have data (or right after a
 * successful full pull that seeds it). The counter lets us detect a wipe:
 * if the epoch is > 0 but all IDB stores are empty, data was erased.
 */
function bumpPopulationEpoch(): void {
  try {
    const n = parseInt(localStorage.getItem(EPOCH_KEY) ?? "0", 10) || 0;
    localStorage.setItem(EPOCH_KEY, String(n + 1));
  } catch {
    // non-fatal
  }
}

function getPopulationEpoch(): number {
  try {
    return parseInt(localStorage.getItem(EPOCH_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

// ─── Server-state cache for push diffs ───────────────────────────────────────
//
// To compute accurate change diffs we need to know what the server last sent
// for each doc. We keep a lightweight in-memory map of {id → server snapshot}
// per collection that is populated during pull and used during push.
//
// This cache lives for the lifetime of the replication manager instance (i.e.
// until logout / page reload). On a fresh reload the pull phase will repopulate
// it before the next push.

type ServerCache = Map<string, SyncableDoc & { _deleted: boolean }>;
const serverStateCache = new Map<CollectionName, ServerCache>();

function getServerCache(collectionName: CollectionName): ServerCache {
  let cache = serverStateCache.get(collectionName);
  if (!cache) {
    cache = new Map();
    serverStateCache.set(collectionName, cache);
  }
  return cache;
}

// ─── Per-collection replication ───────────────────────────────────────────────

type AnyCollection = HosanaCollection<SyncableDoc & Record<string, unknown>>;

/**
 * Replicate one collection (push then pull).
 *
 * @param forceFullPull  When true, ignore the checkpoint and pull from the
 *                       beginning — used after an IDB-wipe is detected.
 */
async function replicateCollection<
  T extends SyncableDoc & Record<string, unknown>,
>(
  collection: AnyCollection,
  collectionName: CollectionName,
  client: ReturnType<typeof getApiClient>,
  forceFullPull = false,
): Promise<void> {
  const checkpoint = await loadCheckpoint(collectionName);
  const serverCache = getServerCache(collectionName);

  // ─ Push FIRST ──────────────────────────────────────────────────────────────
  // Every local write stamps `updatedAt` to now — see collection.ts `_put(doc,
  // "local")` — so this single checkpoint filter reliably catches every local
  // change since the last sync, including isDeleted/_deleted flips.
  const checkpointTs = checkpoint
    ? new Date(checkpoint.updatedAt).toISOString()
    : null;

  const allDocs = (collection as unknown as HosanaCollection<T>).getAllRaw();

  const toPush = checkpointTs
    ? allDocs.filter(
        (d) => typeof d.updatedAt === "string" && d.updatedAt > checkpointTs,
      )
    : allDocs;

  if (toPush.length > 0) {
    const changeRows: ChangeRow<T>[] = toPush.map((doc) => {
      const newState = {
        ...doc,
        _deleted: !!(
          doc._deleted || (doc as Record<string, unknown>)["isDeleted"]
        ),
      } as T & { _deleted: boolean };

      // Use cached server state (from last pull) as the assumed baseline
      const cached =
        (serverCache.get(doc.id) as (T & { _deleted: boolean }) | undefined) ??
        null;

      return {
        newDocumentState: diffFields(newState, cached),
        assumedMasterState: buildAssumedMasterPayload<T>(cached),
      };
    });

    const conflicts = await pushWithConflictRetry<T>(
      client,
      collectionName,
      changeRows,
    );

    // Merge any real conflicts back immediately (server wins on content)
    if (conflicts.length > 0) {
      await Promise.all(
        conflicts.map(async (serverDoc) => {
          serverCache.set(serverDoc.id, serverDoc);
          await (collection as unknown as HosanaCollection<T>)._mergeFromServer(
            serverDoc,
          );
        }),
      );
    }
  }

  // ─ Pull ────────────────────────────────────────────────────────────────────
  let pullCheckpoint = forceFullPull ? null : checkpoint;
  const BATCH = 100;

  while (true) {
    const res = await client.request<{
      documents: T[];
      checkpoint: Checkpoint | null;
    }>(`/replication/${collectionName}/pull`, {
      method: "POST",
      body: JSON.stringify({
        checkpoint: pullCheckpoint || null,
        limit: BATCH,
      }),
    });

    const docs = (res.documents || []).map((d) => ({
      ...d,
      _deleted: !!d._deleted,
    })) as (T & { _deleted: boolean })[];

    if (docs.length > 0) {
      await Promise.all(
        docs.map(async (doc) => {
          if (doc._deleted) {
            // Hard-deleted on server — remove from local store immediately
            serverCache.delete(doc.id);
            (collection as unknown as HosanaCollection<T>)._storeDelete(doc.id);
            await idbDelete(
              (collection as unknown as HosanaCollection<T>)._db,
              (collection as unknown as HosanaCollection<T>)._storeName,
              doc.id,
            );
            notify(
              (collection as unknown as HosanaCollection<T>)._storeName,
              doc.id,
            );
          } else {
            // Cache the server state so push diffs are accurate
            serverCache.set(doc.id, doc);
            await (
              collection as unknown as HosanaCollection<T>
            )._mergeFromServer(doc);
          }
        }),
      );
    }

    if (res.checkpoint) {
      pullCheckpoint = res.checkpoint;
      await saveCheckpoint(collectionName, pullCheckpoint);
    }

    // Stop when server returns fewer than batchSize (last page)
    if (docs.length < BATCH) break;
  }
}

// ─── Replication manager singleton ───────────────────────────────────────────

let replicationManagerInstance: ReplicationManager | null = null;

/** Tear down the existing singleton so a fresh one can be created (e.g. on re-login). */
export function resetReplication(): void {
  if (replicationManagerInstance) {
    replicationManagerInstance.stop();
    replicationManagerInstance = null;
  }
  // Clear server-state caches on logout so they don't bleed between sessions
  serverStateCache.clear();
}

export function setupReplication(db: HosanaDatabase): ReplicationManager {
  if (replicationManagerInstance) return replicationManagerInstance;

  const status$ = makeStatusSubject();
  let currentStatus: ReplicationSyncState = "synced";
  let running = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let onlineListener: (() => void) | null = null;
  let offlineListener: (() => void) | null = null;

  // Debounce guard — prevents overlapping sync runs
  let syncInProgress = false;
  let syncQueued = false;

  // Push-on-save: local writes (insert/upsert/patch) schedule a sync shortly
  // after, instead of waiting for the 15s poll. Debounced so a burst of rapid
  // edits (typing, drag-reorder, etc.) collapses into a single push+pull.
  const SAVE_DEBOUNCE_MS = 800;
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribeLocalChanges: Array<() => void> = [];

  const scheduleSyncOnSave = () => {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      void doSync();
    }, SAVE_DEBOUNCE_MS);
  };

  const updateStatus = (s: ReplicationSyncState) => {
    if (currentStatus !== s) {
      currentStatus = s;
      status$.next(s);
    }
  };

  /**
   * Detect whether the IDB appears to have been wiped since the last session.
   * If the population epoch is > 0 (data was there before) but all collections
   * are empty now, we assume a spurious wipe and force a full pull.
   */
  const detectIdbWipe = (): boolean => {
    if (getPopulationEpoch() === 0) return false; // first-ever run
    const totalDocs =
      db.songs.getAllRaw().length +
      db.folders.getAllRaw().length +
      db.collections.getAllRaw().length +
      db.services.getAllRaw().length +
      db.agendaEvents.getAllRaw().length;
    return totalDocs === 0;
  };

  const doSync = async (forceFullPull = false) => {
    // If already running, queue a follow-up sync instead of overlapping
    if (syncInProgress) {
      syncQueued = true;
      return;
    }

    if (!navigator.onLine) {
      updateStatus("offline");
      return;
    }

    syncInProgress = true;
    updateStatus("syncing");
    const client = getApiClient();

    // Detect IDB wipe on the very first sync of this session
    const idbWiped = forceFullPull || detectIdbWipe();
    if (idbWiped) {
      console.warn(
        "[hosana-repl] IDB appears empty after previously being populated — " +
          "forcing full pull to restore data.",
      );
    }

    try {
      // services first (FK ordering for agendaEvents)
      await replicateCollection(
        db.services as unknown as AnyCollection,
        "services",
        client,
        idbWiped,
      );
      await Promise.all([
        replicateCollection(
          db.songs as unknown as AnyCollection,
          "songs",
          client,
          idbWiped,
        ),
        replicateCollection(
          db.folders as unknown as AnyCollection,
          "folders",
          client,
          idbWiped,
        ),
        replicateCollection(
          db.collections as unknown as AnyCollection,
          "collections",
          client,
          idbWiped,
        ),
      ]);
      await replicateCollection(
        db.agendaEvents as unknown as AnyCollection,
        "agendaEvents",
        client,
        idbWiped,
      );

      // Mark IDB as populated so future sessions can detect a wipe
      bumpPopulationEpoch();

      updateStatus("synced");
    } catch (err) {
      console.error("[hosana-repl] Sync error:", err);
      updateStatus(navigator.onLine ? "error" : "offline");
    } finally {
      syncInProgress = false;
      // If a sync was queued while we were running, kick it off now
      if (syncQueued) {
        syncQueued = false;
        void doSync();
      }
    }
  };

  const start = () => {
    if (running) return;
    running = true;

    // Initial sync (with wipe detection)
    void doSync();

    // Periodic background sync every 15 s
    interval = setInterval(() => void doSync(), 15_000);

    onlineListener = () => void doSync();
    offlineListener = () => updateStatus("offline");
    window.addEventListener("online", onlineListener);
    window.addEventListener("offline", offlineListener);

    // Wire push-on-save: any local write to any managed collection schedules
    // a debounced sync instead of waiting for the 15s poll.
    for (const name of ALL_COLLECTION_NAMES) {
      unsubscribeLocalChanges.push(
        subscribeLocalChange(name, scheduleSyncOnSave),
      );
    }
  };

  const stop = () => {
    running = false;
    if (interval) clearInterval(interval);
    interval = null;
    if (onlineListener) window.removeEventListener("online", onlineListener);
    if (offlineListener) window.removeEventListener("offline", offlineListener);
    onlineListener = null;
    offlineListener = null;

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
    while (unsubscribeLocalChanges.length) {
      unsubscribeLocalChanges.pop()!();
    }
  };

  const replicateNow = async () => {
    if (!navigator.onLine) {
      updateStatus("offline");
      return;
    }
    await doSync();
  };

  replicationManagerInstance = {
    start,
    stop,
    replicateNow,
    status$,
    getStatus: () => currentStatus,
  };

  return replicationManagerInstance;
}
