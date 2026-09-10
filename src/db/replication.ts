/**
 * Hosana HTTP Replication — replaces rxdb/plugins/replication.
 *
 * The server-side HTTP pull/push protocol (endpoints, payloads, checkpoint
 * shape) is completely unchanged. Only the client-side driver that
 * communicates between the server and the local store is rewritten here.
 *
 * Replication strategy:
 *  1. Push FIRST: POST /replication/<collection>/push with all locally
 *     changed/deleted docs since last checkpoint. This ensures local deletes
 *     and edits appear on the server before we pull the authoritative state.
 *  2. Pull: GET /replication/<collection>/pull with the last checkpoint.
 *     Documents are merged into the local store using _mergeFromServer(),
 *     which preserves local-only fields and re-runs computed fields.
 *     Deleted docs (server tombstones) are removed from the local store.
 *  3. Conflict resolution: identical to the old implementation —
 *     spurious conflicts (volatile-field drift only) are auto-retried;
 *     real content conflicts surface as server docs.
 *  4. FK ordering: services always pushed/pulled before agendaEvents.
 */

import { getApiClient } from "@/src/api";
import { idbDelete } from "./engine/idb";
import { notify } from "./engine/bus";
import { HosanaCollection } from "./engine/collection";
import type { HosanaDatabase } from "./database";
import type {
  AgendaEventDocType,
  FolderDocType,
  ServiceDocType,
  SongDocType,
} from "./schemas";

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

type CollectionName = "songs" | "folders" | "services" | "agendaEvents";

// ─── Simple status subject ────────────────────────────────────────────────────

function makeStatusSubject(): StatusSubject {
  const listeners = new Set<(s: ReplicationSyncState) => void>();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return { unsubscribe: () => listeners.delete(fn) };
    },
    next(s) {
      for (const fn of listeners) fn(s);
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

interface ChangeRow<T> {
  newDocumentState: T & { _deleted: boolean };
  assumedMasterState: (T & { _deleted: boolean }) | null;
}

async function pushWithConflictRetry<T extends SyncableDoc>(
  client: ReturnType<typeof getApiClient>,
  collectionName: CollectionName,
  changeRows: ChangeRow<T>[],
): Promise<(T & { _deleted: boolean })[]> {
  let pending = changeRows;
  const realConflicts: (T & { _deleted: boolean })[] = [];

  for (let attempt = 0; attempt <= CONFLICT_RETRY_LIMIT; attempt++) {
    const formattedChanges = pending.map((row) => ({
      newDocumentState: {
        ...row.newDocumentState,
        _deleted: !!row.newDocumentState._deleted,
      },
      assumedMasterState: row.assumedMasterState
        ? {
            ...row.assumedMasterState,
            _deleted: !!row.assumedMasterState._deleted,
          }
        : null,
    }));

    const res = await client.request<{ conflicts?: T[] } | T[]>(
      `/replication/${collectionName}/push`,
      {
        method: "POST",
        body: JSON.stringify({ changeRows: formattedChanges }),
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
        isSpuriousConflict(row.assumedMasterState ?? undefined, serverDoc);

      if (canRetry) {
        retryRows.push({
          newDocumentState: row.newDocumentState,
          assumedMasterState: serverDoc,
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

// ─── Checkpoint persistence ───────────────────────────────────────────────────

const CP_KEY = "hosana_repl_checkpoint";

function loadCheckpoint(collectionName: CollectionName): Checkpoint | null {
  try {
    const raw = localStorage.getItem(`${CP_KEY}_${collectionName}`);
    return raw ? (JSON.parse(raw) as Checkpoint) : null;
  } catch {
    return null;
  }
}

function saveCheckpoint(collectionName: CollectionName, cp: Checkpoint): void {
  try {
    localStorage.setItem(`${CP_KEY}_${collectionName}`, JSON.stringify(cp));
  } catch {
    // storage quota exceeded — non-fatal
  }
}

// ─── Per-collection replication ───────────────────────────────────────────────

type AnyCollection = HosanaCollection<SyncableDoc & Record<string, unknown>>;

async function replicateCollection<
  T extends SyncableDoc & Record<string, unknown>,
>(
  collection: AnyCollection,
  collectionName: CollectionName,
  client: ReturnType<typeof getApiClient>,
): Promise<void> {
  const checkpoint = loadCheckpoint(collectionName);
  const checkpointTs = checkpoint
    ? new Date(checkpoint.updatedAt).toISOString()
    : null;

  // ─ Push FIRST ──────────────────────────────────────────────────────────────
  // Include both changed docs AND locally deleted docs (tombstones).
  const allDocs = (collection as unknown as HosanaCollection<T>).getAllRaw();

  const pendingDocs = checkpointTs
    ? allDocs.filter(
        (d) =>
          typeof d.updatedAt === "string" && d.updatedAt > checkpointTs,
      )
    : allDocs;

  // Also collect soft-deleted docs that need to be pushed as tombstones
  const deletedDocs = allDocs.filter(
    (d) => d._deleted === true || (d as Record<string, unknown>)["isDeleted"] === true,
  );

  // Merge pending + deleted (deduplicated by id)
  const toPushMap = new Map<string, T>();
  for (const d of pendingDocs) toPushMap.set(d.id, d);
  for (const d of deletedDocs) toPushMap.set(d.id, d);
  const toPush = Array.from(toPushMap.values());

  if (toPush.length > 0) {
    const changeRows: ChangeRow<T>[] = toPush.map((doc) => ({
      newDocumentState: {
        ...doc,
        _deleted: !!(doc._deleted || (doc as Record<string, unknown>)["isDeleted"]),
      } as T & { _deleted: boolean },
      assumedMasterState: null,
    }));

    const conflicts = await pushWithConflictRetry<T>(
      client,
      collectionName,
      changeRows,
    );

    // Merge any real conflicts back immediately (server wins on content)
    if (conflicts.length > 0) {
      await Promise.all(
        conflicts.map((serverDoc) =>
          (collection as unknown as HosanaCollection<T>)._mergeFromServer(
            serverDoc,
          ),
        ),
      );
    }
  }

  // ─ Pull ────────────────────────────────────────────────────────────────────
  let pullCheckpoint = checkpoint;
  const BATCH = 100;

  // eslint-disable-next-line no-constant-condition
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
    })) as T[];

    if (docs.length > 0) {
      // Process all docs in parallel for speed
      await Promise.all(
        docs.map(async (doc) => {
          if (doc._deleted) {
            // Hard-deleted on server — remove from local store immediately
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
            await (collection as unknown as HosanaCollection<T>)._mergeFromServer(
              doc,
            );
          }
        }),
      );
    }

    if (res.checkpoint) {
      pullCheckpoint = res.checkpoint;
      saveCheckpoint(collectionName, pullCheckpoint);
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

  const updateStatus = (s: ReplicationSyncState) => {
    if (currentStatus !== s) {
      currentStatus = s;
      status$.next(s);
    }
  };

  const doSync = async () => {
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

    try {
      // services first (FK ordering for agendaEvents)
      await replicateCollection(
        db.services as unknown as AnyCollection,
        "services",
        client,
      );
      await Promise.all([
        replicateCollection(
          db.songs as unknown as AnyCollection,
          "songs",
          client,
        ),
        replicateCollection(
          db.folders as unknown as AnyCollection,
          "folders",
          client,
        ),
      ]);
      await replicateCollection(
        db.agendaEvents as unknown as AnyCollection,
        "agendaEvents",
        client,
      );

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

    // Initial sync
    void doSync();

    // Periodic background sync every 15 s (was 30 s)
    interval = setInterval(() => void doSync(), 15_000);

    onlineListener = () => void doSync();
    offlineListener = () => updateStatus("offline");
    window.addEventListener("online", onlineListener);
    window.addEventListener("offline", offlineListener);
  };

  const stop = () => {
    running = false;
    if (interval) clearInterval(interval);
    interval = null;
    if (onlineListener) window.removeEventListener("online", onlineListener);
    if (offlineListener) window.removeEventListener("offline", offlineListener);
    onlineListener = null;
    offlineListener = null;
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
