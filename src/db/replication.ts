/**
 * Hosana HTTP Replication — replaces rxdb/plugins/replication.
 *
 * The server-side HTTP pull/push protocol (endpoints, payloads, checkpoint
 * shape) is completely unchanged. Only the client-side driver that
 * communicates between the server and the local store is rewritten here.
 *
 * Replication strategy:
 *  1. Pull: GET /replication/<collection>/pull with the last checkpoint.
 *     Documents are merged into the local store using _mergeFromServer(),
 *     which preserves local-only fields and re-runs computed fields.
 *  2. Push: POST /replication/<collection>/push with change rows built
 *     from local docs whose updatedAt is newer than the checkpoint.
 *  3. Conflict resolution: identical to the old implementation —
 *     spurious conflicts (volatile-field drift only) are auto-retried;
 *     real content conflicts surface as server docs.
 *  4. FK ordering: services always pushed before agendaEvents.
 */

import { getApiClient } from "@/src/api";
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
  subscribe: (fn: (s: ReplicationSyncState) => void) => { unsubscribe: () => void };
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
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
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
      newDocumentState: { ...row.newDocumentState, _deleted: !!row.newDocumentState._deleted },
      assumedMasterState: row.assumedMasterState
        ? { ...row.assumedMasterState, _deleted: !!row.assumedMasterState._deleted }
        : null,
    }));

    const res = await client.request<{ conflicts?: T[] } | T[]>(
      `/replication/${collectionName}/push`,
      {
        method: "POST",
        body: JSON.stringify({ changeRows: formattedChanges }),
      },
    );

    const conflicts = (Array.isArray(res) ? res : (res as { conflicts?: T[] })?.conflicts || []).map(
      (doc) => ({ ...doc, _deleted: !!doc._deleted }) as T & { _deleted: boolean },
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
          row.assumedMasterState ?? undefined,
          serverDoc,
        );

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

async function replicateCollection<T extends SyncableDoc & Record<string, unknown>>(
  collection: AnyCollection,
  collectionName: CollectionName,
  client: ReturnType<typeof getApiClient>,
): Promise<void> {
  // ─ Pull ──────────────────────────────────────────────────────────────────
  let checkpoint = loadCheckpoint(collectionName);
  const BATCH = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await client.request<{
      documents: T[];
      checkpoint: Checkpoint | null;
    }>(`/replication/${collectionName}/pull`, {
      method: "POST",
      body: JSON.stringify({
        checkpoint: checkpoint || null,
        limit: BATCH,
      }),
    });

    const docs = (res.documents || []).map((d) => ({
      ...d,
      _deleted: !!d._deleted,
    })) as T[];

    if (docs.length > 0) {
      for (const doc of docs) {
        if (doc._deleted) {
          // Hard-deleted on server — remove from local store
          await collection._put({ ...doc } as T & Record<string, unknown>);
        } else {
          await (collection as unknown as HosanaCollection<T>)._mergeFromServer(doc);
        }
      }
    }

    if (res.checkpoint) {
      checkpoint = res.checkpoint;
      saveCheckpoint(collectionName, checkpoint);
    }

    // Stop when server returns fewer than batchSize (last page)
    if (docs.length < BATCH) break;
  }

  // ─ Push ──────────────────────────────────────────────────────────────────
  const allDocs = (collection as unknown as HosanaCollection<T>).getAllRaw();
  const serverCheckpoint = checkpoint;

  // Only push docs updated after the checkpoint's updatedAt
  const pendingDocs = serverCheckpoint
    ? allDocs.filter(
        (d) =>
          !d._deleted &&
          typeof d.updatedAt === "string" &&
          d.updatedAt > new Date(serverCheckpoint.updatedAt).toISOString(),
      )
    : allDocs.filter((d) => !d._deleted);

  if (pendingDocs.length === 0) return;

  const changeRows: ChangeRow<T>[] = pendingDocs.map((doc) => ({
    newDocumentState: { ...doc, _deleted: false } as T & { _deleted: boolean },
    assumedMasterState: null, // let server decide conflicts
  }));

  const conflicts = await pushWithConflictRetry<T>(
    client,
    collectionName,
    changeRows,
  );

  // Merge any real conflicts back (server wins on content)
  for (const serverDoc of conflicts) {
    await (collection as unknown as HosanaCollection<T>)._mergeFromServer(serverDoc);
  }
}

// ─── Replication manager singleton ───────────────────────────────────────────

let replicationManagerInstance: ReplicationManager | null = null;

export function setupReplication(db: HosanaDatabase): ReplicationManager {
  if (replicationManagerInstance) return replicationManagerInstance;

  const status$ = makeStatusSubject();
  let currentStatus: ReplicationSyncState = "synced";
  let running = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let onlineListener: (() => void) | null = null;
  let offlineListener: (() => void) | null = null;

  const updateStatus = (s: ReplicationSyncState) => {
    if (currentStatus !== s) {
      currentStatus = s;
      status$.next(s);
    }
  };

  const doSync = async () => {
    if (!navigator.onLine) {
      updateStatus("offline");
      return;
    }

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
        replicateCollection(db.songs as unknown as AnyCollection, "songs", client),
        replicateCollection(db.folders as unknown as AnyCollection, "folders", client),
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
    }
  };

  const start = () => {
    if (running) return;
    running = true;

    // Initial sync
    void doSync();

    // Periodic background sync every 30 s
    interval = setInterval(() => void doSync(), 30_000);

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
