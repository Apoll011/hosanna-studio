/**
 * Hosana HTTP Replication — replaces rxdb/plugins/replication.
 *
 * The server-side HTTP pull/push protocol (endpoints, payloads, checkpoint
 * shape) is completely unchanged. Only the client-side driver that
 * communicates between the server and the local store is rewritten here.
 *
 * Replication strategy:
 *  1. Push FIRST: POST /replication/<collection>/push with locally
 *     changed/deleted docs since last checkpoint.
 *       - newDocumentState: id + updatedAt + only changed fields (partial
 *         update; creates still send the full doc when no server baseline).
 *       - assumedMasterState: { id, updatedAt } from the last known server
 *         snapshot (server conflict-checks only on updatedAt). Null when the
 *         client has never seen this id on the server (insert). The server
 *         rejects updates of existing rows without assumedMasterState.
 *     Soft-delete (`isDeleted`) is a normal field — NOT the `_deleted` tombstone.
 *  2. Pull: POST /replication/<collection>/pull with the last checkpoint.
 *     Documents are merged into the local store using `_mergeBatchFromServer()`,
 *     which preserves local-only fields and re-runs computed fields.
 *     Deleted docs (server tombstones) are removed from the local store.
 *  3. Conflict resolution: spurious conflicts (volatile-field drift only) are
 *     auto-retried; real content conflicts surface as server docs.
 *  4. FK ordering: services always pushed/pulled before agendaEvents.
 *
 * Checkpoint resilience:
 *  - Checkpoints are saved in BOTH localStorage AND a dedicated IndexedDB store
 *    ("repl_checkpoints"). On startup the IDB copy is preferred (it survives
 *    Safari ITP / quota eviction that can wipe localStorage). If IDB is empty
 *    but localStorage has a value, it is migrated to IDB.
 *
 * Server-state cache:
 *  - Last-pulled/pushed snapshots are kept in memory and dual-written to the
 *    checkpoint IDB. They are the source of assumedMasterState.updatedAt and
 *    the baseline for newDocumentState field diffs.
 *  - Updated after every successful push AND every pull.
 *  - After a page refresh the IDB copy is hydrated; if an id is still missing,
 *    the pre-write local snapshot (captured on patch/upsert) seeds the baseline
 *    so the next push stays partial instead of full+null assumed.
 *
 * IDB-wipe resilience:
 *  - On startup we detect whether IDB appears empty after being previously
 *    populated (via a "population-epoch" flag in localStorage). If all stores
 *    read back 0 rows but the epoch flag says they were populated before, we
 *    trigger an immediate full pull (checkpoint = null) for every collection.
 */

import { getApiClient } from "@/src/api";
import type { HosanaDatabase } from "./database";
import {
  getCheckpointDbName,
  getCheckpointLsPrefix,
  getEpochLsKey,
} from "./dbNames";
import { subscribeLocalChange, subscribePushBaseline } from "./engine/bus";
import { HosanaCollection } from "./engine/collection";
import { idbGet, idbPut, openIDB } from "./engine/idb";

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

const PULL_BATCH = 100;
const PUSH_BATCH = 50;

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
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
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
 * Strip local-only / engine-internal fields before anything hits the wire.
 */
function stripNonReplicatedFields<T extends SyncableDoc>(
  doc: T,
  localFields: ReadonlySet<string>,
): T {
  const out: Record<string, unknown> = { ...doc };
  for (const f of localFields) delete out[f];
  delete out["__tombstone"];
  delete out["score"]; // belt-and-suspenders for songs
  return out as T;
}

type WirePartial<T> = { id: string; updatedAt: string } & Partial<T>;

function isVolatileKey(key: string): boolean {
  return (VOLATILE_FIELDS as readonly string[]).includes(key);
}

/**
 * Build newDocumentState for the wire.
 * Always includes `id` + `updatedAt`. With a known server baseline, only
 * changed fields are included (server applies partial updates). Creates
 * (no baseline) send the full document — assumedMasterState will be null and
 * the server treats that as an insert.
 */
function diffNewDocumentState<T extends SyncableDoc>(
  current: T & { _deleted: boolean },
  previous: (T & { _deleted: boolean }) | null,
): WirePartial<T> & { _deleted?: boolean } {
  if (!previous) {
    // New doc / unknown server state — full create payload (minus volatile).
    const full: Record<string, unknown> = { ...current };
    for (const field of VOLATILE_FIELDS) delete full[field];
    return full as WirePartial<T> & { _deleted?: boolean };
  }

  const delta: Record<string, unknown> = {
    id: current.id,
    updatedAt: current.updatedAt,
  };

  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);

  for (const key of keys) {
    if (key === "id" || key === "updatedAt" || isVolatileKey(key)) continue;
    if (
      !deepEqual(
        (current as Record<string, unknown>)[key],
        (previous as Record<string, unknown>)[key],
      )
    ) {
      delta[key] = (current as Record<string, unknown>)[key];
    }
  }

  return delta as WirePartial<T> & { _deleted?: boolean };
}

/**
 * assumedMasterState on the wire: only id + updatedAt from the last known
 * server snapshot. The server conflict-checks exclusively on updatedAt
 * (`hasConflict` / optimistic `updateMany` where clause) — other assumed
 * fields are ignored.
 */
function toAssumedMasterState(assumed: SyncableDoc & { _deleted?: boolean }): {
  id: string;
  updatedAt: string;
} {
  return { id: assumed.id, updatedAt: assumed.updatedAt };
}

/** Wire row for POST /push. */
interface ChangeRow<T> {
  newDocumentState: WirePartial<T> & { _deleted?: boolean };
  assumedMasterState: { id: string; updatedAt: string } | null;
}

/**
 * Local pending change. Full docs stay in memory for conflict retry /
 * spurious-conflict checks; only a compact delta is serialized to the wire.
 */
interface PendingChange<T extends SyncableDoc> {
  fullNew: T & { _deleted: boolean };
  /** Last known server snapshot for this id, or null if never synced. */
  fullAssumed: (T & { _deleted: boolean }) | null;
}

function toChangeRow<T extends SyncableDoc>(
  change: PendingChange<T>,
): ChangeRow<T> {
  return {
    newDocumentState: diffNewDocumentState(change.fullNew, change.fullAssumed),
    assumedMasterState: change.fullAssumed
      ? toAssumedMasterState(change.fullAssumed)
      : null,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (arr.length <= size) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function pushWithConflictRetry<T extends SyncableDoc>(
  client: ReturnType<typeof getApiClient>,
  collectionName: CollectionName,
  changes: PendingChange<T>[],
): Promise<(T & { _deleted: boolean })[]> {
  let pending = changes;
  const realConflicts: (T & { _deleted: boolean })[] = [];

  for (let attempt = 0; attempt <= CONFLICT_RETRY_LIMIT; attempt++) {
    const changeRows: ChangeRow<T>[] = pending.map(toChangeRow);
    const res = await client.request<{ conflicts?: T[] } | T[]>(
      `/replication/${collectionName}/push`,
      {
        method: "POST",
        body: JSON.stringify({ changeRows }),
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
    const retryChanges: PendingChange<T>[] = [];

    for (const change of pending) {
      const serverDoc = conflictsById.get(change.fullNew.id);
      if (!serverDoc) continue;

      // Compare full assumed snapshot (not the wire delta) so partial
      // payloads don't break spurious-conflict detection.
      // Also retry when assumed was missing (cold cache after refresh):
      // re-apply local changes onto the server doc as the new baseline.
      const missingAssumed = change.fullAssumed == null;
      const canRetry =
        attempt < CONFLICT_RETRY_LIMIT &&
        (missingAssumed ||
          isSpuriousConflict(change.fullAssumed as T | undefined, serverDoc));

      if (canRetry) {
        retryChanges.push({
          fullNew: change.fullNew,
          fullAssumed: serverDoc,
        });
      } else {
        realConflicts.push(serverDoc);
      }
    }

    if (retryChanges.length === 0) break;
    pending = retryChanges;
  }

  return realConflicts;
}

// ─── Checkpoint + server-cache persistence (dual-write: IDB + localStorage) ──

let _cpDb: IDBDatabase | null = null;
let _cpDbName: string | null = null;
const CP_IDB_VERSION = 2;
const CP_STORE = "checkpoints";
const CACHE_STORE = "server_state";

async function getCheckpointDb(): Promise<IDBDatabase> {
  const wantedName = getCheckpointDbName();
  if (_cpDb && _cpDbName === wantedName) {
    try {
      // Touch a store name list — throws if the connection was closed.
      void _cpDb.objectStoreNames.length;
      return _cpDb;
    } catch {
      _cpDb = null;
      _cpDbName = null;
    }
  }
  _cpDb = await openIDB(wantedName, CP_IDB_VERSION, (db, oldVersion) => {
    if (oldVersion < 1) {
      db.createObjectStore(CP_STORE, { keyPath: "collection" });
    }
    if (oldVersion < 2 && !db.objectStoreNames.contains(CACHE_STORE)) {
      db.createObjectStore(CACHE_STORE, { keyPath: "collection" });
    }
  });
  _cpDbName = wantedName;
  _cpDb.onclose = () => {
    _cpDb = null;
    _cpDbName = null;
  };
  return _cpDb;
}

async function loadCheckpoint(
  collectionName: CollectionName,
): Promise<Checkpoint | null> {
  try {
    const db = await getCheckpointDb();
    const row = await idbGet<{ collection: string; cp: Checkpoint }>(
      db,
      CP_STORE,
      collectionName,
    );
    if (row?.cp) return row.cp;
  } catch {
    _cpDb = null;
    _cpDbName = null;
  }

  try {
    const raw = localStorage.getItem(
      `${getCheckpointLsPrefix()}_${collectionName}`,
    );
    if (raw) {
      const cp = JSON.parse(raw) as Checkpoint;
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
  try {
    const db = await getCheckpointDb();
    await idbPut(db, CP_STORE, { collection: collectionName, cp });
  } catch {
    _cpDb = null;
    _cpDbName = null;
  }

  try {
    localStorage.setItem(
      `${getCheckpointLsPrefix()}_${collectionName}`,
      JSON.stringify(cp),
    );
  } catch {
    // Storage quota exceeded — non-fatal
  }
}

// ─── IDB-wipe detection ───────────────────────────────────────────────────────

/**
 * Mark that the main IDB has been confirmed populated.
 * Only set once (epoch 0 → 1) so empty-account sessions don't keep triggering
 * false-positive wipe detection forever.
 */
function markPopulationEpoch(): void {
  try {
    if (getPopulationEpoch() > 0) return;
    localStorage.setItem(getEpochLsKey(), "1");
  } catch {
    // non-fatal
  }
}

function getPopulationEpoch(): number {
  try {
    return parseInt(localStorage.getItem(getEpochLsKey()) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

// ─── Server-state cache for push diffs ───────────────────────────────────────

type ServerCache = Map<string, SyncableDoc & { _deleted: boolean }>;
const serverStateCache = new Map<CollectionName, ServerCache>();
const serverCacheHydrated = new Set<CollectionName>();

function getServerCache(collectionName: CollectionName): ServerCache {
  let cache = serverStateCache.get(collectionName);
  if (!cache) {
    cache = new Map();
    serverStateCache.set(collectionName, cache);
  }
  return cache;
}

async function hydrateServerCache(
  collectionName: CollectionName,
): Promise<ServerCache> {
  const cache = getServerCache(collectionName);
  if (serverCacheHydrated.has(collectionName)) return cache;

  try {
    const db = await getCheckpointDb();
    const row = await idbGet<{
      collection: string;
      docs: Array<SyncableDoc & { _deleted: boolean }>;
    }>(db, CACHE_STORE, collectionName);
    if (row?.docs) {
      for (const doc of row.docs) {
        if (doc?.id) cache.set(doc.id, doc);
      }
    }
  } catch {
    _cpDb = null;
  }

  serverCacheHydrated.add(collectionName);
  return cache;
}

async function persistServerCache(
  collectionName: CollectionName,
): Promise<void> {
  const cache = getServerCache(collectionName);
  try {
    const db = await getCheckpointDb();
    await idbPut(db, CACHE_STORE, {
      collection: collectionName,
      docs: Array.from(cache.values()),
    });
  } catch {
    _cpDb = null;
  }
}

/**
 * Seed the in-memory push baseline from a pre-write local snapshot when we
 * don't yet have a last-known server state for this id (common after refresh
 * before the first successful sync of the session). Only fills gaps — never
 * overwrites a snapshot from pull/push/IDB hydrate.
 */
function rememberPushBaseline(
  collectionName: CollectionName,
  previousDoc: Record<string, unknown>,
  localFields: ReadonlySet<string>,
): void {
  const id = previousDoc.id;
  if (typeof id !== "string" || !id) return;

  const cache = getServerCache(collectionName);
  if (cache.has(id)) return;

  const stripped = stripNonReplicatedFields(
    {
      ...previousDoc,
      _deleted: !!previousDoc._deleted,
    } as SyncableDoc & { _deleted: boolean } & Record<string, unknown>,
    localFields,
  );
  cache.set(id, stripped);
}

// ─── Per-collection replication ───────────────────────────────────────────────

type AnyCollection = HosanaCollection<SyncableDoc & Record<string, unknown>>;

/**
 * Compare checkpoint (numeric ms or ISO) against a doc's ISO updatedAt.
 */
function checkpointToIso(cp: Checkpoint): string {
  return typeof cp.updatedAt === "number"
    ? new Date(cp.updatedAt).toISOString()
    : String(cp.updatedAt);
}

/**
 * Replicate one collection (push then pull).
 *
 * @param forceFullPull  When true, ignore the checkpoint and pull from the
 *                       beginning — used after an IDB-wipe is detected.
 * @param shouldAbort    Returns true when the manager was stopped mid-sync.
 */
async function replicateCollection<
  T extends SyncableDoc & Record<string, unknown>,
>(
  collection: AnyCollection,
  collectionName: CollectionName,
  client: ReturnType<typeof getApiClient>,
  forceFullPull = false,
  shouldAbort: () => boolean = () => false,
): Promise<void> {
  if (shouldAbort()) return;

  const checkpoint = await loadCheckpoint(collectionName);
  const serverCache = await hydrateServerCache(collectionName);
  const localFields = collection.getLocalFieldNames();
  let cacheDirty = false;

  // ─ Push FIRST ──────────────────────────────────────────────────────────────
  const checkpointTs = checkpoint ? checkpointToIso(checkpoint) : null;
  const allDocs = (collection as unknown as HosanaCollection<T>).getAllRaw();

  const toPush = allDocs.filter((d) => {
    const stripped = stripNonReplicatedFields(d, localFields);
    const newState = {
      ...stripped,
      _deleted: !!stripped._deleted,
    } as T & { _deleted: boolean };

    const cached = serverCache.get(d.id) as
      (T & { _deleted: boolean }) | undefined;

    // Prefer a content/tombstone diff against the last-known server snapshot.
    // This avoids re-pushing every cycle when the pull checkpoint hasn't yet
    // advanced past a locally stamped updatedAt.
    if (cached) {
      return (
        newState._deleted !== !!cached._deleted ||
        newState.updatedAt !== cached.updatedAt ||
        !deepEqual(
          omitVolatile(newState as Record<string, unknown>),
          omitVolatile(cached as Record<string, unknown>),
        )
      );
    }

    // No baseline yet — fall back to the pull checkpoint watermark.
    return (
      !checkpointTs ||
      (typeof d.updatedAt === "string" && d.updatedAt > checkpointTs)
    );
  });

  if (toPush.length > 0 && !shouldAbort()) {
    const pushedFull = new Map<string, T & { _deleted: boolean }>();

    const pendingChanges: PendingChange<T>[] = toPush.map((doc) => {
      const stripped = stripNonReplicatedFields(doc, localFields);
      // Soft-delete (`isDeleted`) is a normal replicated field.
      // Only the explicit `_deleted` flag is the hard-delete tombstone.
      const newState = {
        ...stripped,
        _deleted: !!stripped._deleted,
      } as T & { _deleted: boolean };

      pushedFull.set(doc.id, newState);

      const cached =
        (serverCache.get(doc.id) as (T & { _deleted: boolean }) | undefined) ??
        null;

      return {
        fullNew: newState,
        fullAssumed: cached,
      };
    });

    const realConflicts: (T & { _deleted: boolean })[] = [];

    for (const batch of chunkArray(pendingChanges, PUSH_BATCH)) {
      if (shouldAbort()) return;
      const conflicts = await pushWithConflictRetry<T>(
        client,
        collectionName,
        batch,
      );
      realConflicts.push(...conflicts);
    }

    const conflictIds = new Set(realConflicts.map((c) => c.id));

    // Update cache for successfully pushed docs; purge local tombstones.
    const tombstonesToPurge: string[] = [];
    for (const [id, full] of pushedFull) {
      if (conflictIds.has(id)) continue;
      if (full._deleted) {
        serverCache.delete(id);
        tombstonesToPurge.push(id);
      } else {
        serverCache.set(id, full);
      }
      cacheDirty = true;
    }

    if (tombstonesToPurge.length > 0) {
      await (collection as unknown as HosanaCollection<T>)._purgeIds(
        tombstonesToPurge,
      );
    }

    // Merge real conflicts (server wins on content)
    if (realConflicts.length > 0) {
      const live: (T & { _deleted: boolean })[] = [];
      const deletedIds: string[] = [];
      for (const serverDoc of realConflicts) {
        if (serverDoc._deleted) {
          serverCache.delete(serverDoc.id);
          deletedIds.push(serverDoc.id);
        } else {
          serverCache.set(serverDoc.id, serverDoc);
          live.push(serverDoc);
        }
        cacheDirty = true;
      }
      if (deletedIds.length > 0) {
        await (collection as unknown as HosanaCollection<T>)._purgeIds(
          deletedIds,
        );
      }
      if (live.length > 0) {
        await (
          collection as unknown as HosanaCollection<T>
        )._mergeBatchFromServer(live, { force: true });
      }
    }
  }

  // ─ Pull ────────────────────────────────────────────────────────────────────
  let pullCheckpoint = forceFullPull ? null : checkpoint;

  while (!shouldAbort()) {
    const res = await client.request<{
      documents: T[];
      checkpoint: Checkpoint | null;
    }>(`/replication/${collectionName}/pull`, {
      method: "POST",
      body: JSON.stringify({
        checkpoint: pullCheckpoint || null,
        limit: PULL_BATCH,
      }),
    });

    const docs = (res.documents || []).map((d) => ({
      ...d,
      _deleted: !!d._deleted,
    })) as (T & { _deleted: boolean })[];

    if (docs.length > 0) {
      const live: (T & { _deleted: boolean })[] = [];
      const deletedIds: string[] = [];

      for (const doc of docs) {
        if (doc._deleted) {
          serverCache.delete(doc.id);
          deletedIds.push(doc.id);
        } else {
          serverCache.set(doc.id, stripNonReplicatedFields(doc, localFields));
          live.push(doc);
        }
        cacheDirty = true;
      }

      if (deletedIds.length > 0) {
        await (collection as unknown as HosanaCollection<T>)._purgeIds(
          deletedIds,
        );
      }
      if (live.length > 0) {
        await (
          collection as unknown as HosanaCollection<T>
        )._mergeBatchFromServer(live);
      }
    }

    if (res.checkpoint) {
      pullCheckpoint = res.checkpoint;
      await saveCheckpoint(collectionName, pullCheckpoint);
    }

    if (docs.length < PULL_BATCH) break;
  }

  if (cacheDirty && !shouldAbort()) {
    await persistServerCache(collectionName);
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
  serverStateCache.clear();
  serverCacheHydrated.clear();
  _cpDb = null;
  _cpDbName = null;
}

export function setupReplication(db: HosanaDatabase): ReplicationManager {
  if (replicationManagerInstance) return replicationManagerInstance;

  const status$ = makeStatusSubject();
  let currentStatus: ReplicationSyncState = "synced";
  let running = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let onlineListener: (() => void) | null = null;
  let offlineListener: (() => void) | null = null;

  // Coalescing sync lock — callers of replicateNow always await until the
  // in-flight sync AND any follow-ups queued while it ran have finished.
  let currentRun: Promise<void> | null = null;
  let syncQueued = false;
  let queuedForceFullPull = false;

  const SAVE_DEBOUNCE_MS = 800;
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribeLocalChanges: Array<() => void> = [];
  const unsubscribePushBaselines: Array<() => void> = [];

  // Capture pre-write baselines for the lifetime of this manager (including
  // before start()), so an edit after refresh still gets a partial push.
  // Also kick off IDB hydrate so persisted server snapshots win over local
  // pre-images when available.
  for (const name of ALL_COLLECTION_NAMES) {
    void hydrateServerCache(name);
    const collection = db[name] as unknown as AnyCollection;
    unsubscribePushBaselines.push(
      subscribePushBaseline(name, (previousDoc) => {
        rememberPushBaseline(
          name,
          previousDoc,
          collection.getLocalFieldNames(),
        );
      }),
    );
  }

  const scheduleSyncOnSave = () => {
    if (!running) return;
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
    if (getPopulationEpoch() === 0) return false;
    const totalDocs =
      db.songs.getAllRaw().length +
      db.folders.getAllRaw().length +
      db.collections.getAllRaw().length +
      db.services.getAllRaw().length +
      db.agendaEvents.getAllRaw().length;
    return totalDocs === 0;
  };

  const runSyncOnce = async (forceFullPull: boolean) => {
    if (!navigator.onLine) {
      updateStatus("offline");
      return;
    }

    updateStatus("syncing");
    const client = getApiClient();
    const shouldAbort = () => !running;

    const idbWiped = forceFullPull || detectIdbWipe();
    if (idbWiped) {
      console.warn(
        "[hosana-repl] IDB appears empty after previously being populated — " +
          "forcing full pull to restore data.",
      );
    }

    // services first (FK ordering for agendaEvents)
    await replicateCollection(
      db.services as unknown as AnyCollection,
      "services",
      client,
      idbWiped,
      shouldAbort,
    );
    if (shouldAbort()) return;

    await Promise.all([
      replicateCollection(
        db.songs as unknown as AnyCollection,
        "songs",
        client,
        idbWiped,
        shouldAbort,
      ),
      replicateCollection(
        db.folders as unknown as AnyCollection,
        "folders",
        client,
        idbWiped,
        shouldAbort,
      ),
      replicateCollection(
        db.collections as unknown as AnyCollection,
        "collections",
        client,
        idbWiped,
        shouldAbort,
      ),
    ]);
    if (shouldAbort()) return;

    await replicateCollection(
      db.agendaEvents as unknown as AnyCollection,
      "agendaEvents",
      client,
      idbWiped,
      shouldAbort,
    );
    if (shouldAbort()) return;

    // Only mark populated when we actually have data (avoids false wipe
    // detection for brand-new empty accounts).
    const totalDocs =
      db.songs.getAllRaw().length +
      db.folders.getAllRaw().length +
      db.collections.getAllRaw().length +
      db.services.getAllRaw().length +
      db.agendaEvents.getAllRaw().length;
    if (totalDocs > 0) markPopulationEpoch();

    updateStatus("synced");
  };

  const doSync = (forceFullPull = false): Promise<void> => {
    syncQueued = true;
    queuedForceFullPull = queuedForceFullPull || forceFullPull;

    if (currentRun) return currentRun;

    currentRun = (async () => {
      try {
        while (syncQueued) {
          if (!running) {
            syncQueued = false;
            queuedForceFullPull = false;
            break;
          }
          const force = queuedForceFullPull;
          syncQueued = false;
          queuedForceFullPull = false;
          try {
            await runSyncOnce(force);
          } catch (err) {
            console.error("[hosana-repl] Sync error:", err);
            updateStatus(navigator.onLine ? "error" : "offline");
          }
        }
      } finally {
        const followUp = syncQueued && running;
        const force = queuedForceFullPull;
        currentRun = null;
        if (followUp) {
          await doSync(force);
        }
      }
    })();

    return currentRun;
  };

  const start = () => {
    if (running) return;
    running = true;

    void doSync();

    interval = setInterval(() => {
      if (running) void doSync();
    }, 15_000);

    onlineListener = () => {
      if (running) void doSync();
    };
    offlineListener = () => updateStatus("offline");
    window.addEventListener("online", onlineListener);
    window.addEventListener("offline", offlineListener);

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
    syncQueued = false;
    queuedForceFullPull = false;
    while (unsubscribeLocalChanges.length) {
      unsubscribeLocalChanges.pop()!();
    }
    while (unsubscribePushBaselines.length) {
      unsubscribePushBaselines.pop()!();
    }
  };

  const replicateNow = async () => {
    if (!navigator.onLine) {
      updateStatus("offline");
      return;
    }
    // Ensure shouldAbort() stays false for an on-demand sync even if start()
    // hasn't been called (or was stopped).
    const wasRunning = running;
    if (!wasRunning) running = true;
    try {
      await doSync();
    } finally {
      if (!wasRunning) running = false;
    }
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
