/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { messageText, type AiThread, type AiThreadSummary } from "./types";

/**
 * Local chat history (per organization + user) in a dedicated IndexedDB.
 * Intentionally independent from the replication DB so a replication reset
 * never wipes conversations. All calls fail soft — chat works without it.
 */

const DB_NAME = "hosanna-ai-chat";
const DB_VERSION = 1;
const META = "meta";
const THREADS = "threads";
export const MAX_THREADS_PER_SCOPE = 40;

type MetaRecord = AiThreadSummary & { key: string; scope: string };
type ThreadRecord = { key: string; scope: string; thread: AiThread };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" }).createIndex(
          "scope",
          "scope",
        );
      }
      if (!db.objectStoreNames.contains(THREADS)) {
        db.createObjectStore(THREADS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const k = (scope: string, id: string) => `${scope}::${id}`;

export function deriveThreadTitle(thread: AiThread): string {
  const first = thread.messages.find((m) => m.role === "user");
  const text = first ? messageText(first) : "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine;
}

export const threadStore = {
  async list(scope: string): Promise<AiThreadSummary[]> {
    try {
      const db = await openDb();
      const rows = await wrap<MetaRecord[]>(
        db
          .transaction(META, "readonly")
          .objectStore(META)
          .index("scope")
          .getAll(IDBKeyRange.only(scope)),
      );
      return rows
        .map(({ key: _k, scope: _s, ...summary }) => summary)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  async load(scope: string, id: string): Promise<AiThread | null> {
    try {
      const db = await openDb();
      const rec = await wrap<ThreadRecord | undefined>(
        db
          .transaction(THREADS, "readonly")
          .objectStore(THREADS)
          .get(k(scope, id)),
      );
      return rec?.thread ?? null;
    } catch {
      return null;
    }
  },

  async save(scope: string, thread: AiThread): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction([META, THREADS], "readwrite");
      const meta: MetaRecord = {
        key: k(scope, thread.id),
        scope,
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        messageCount: thread.messages.length,
      };
      tx.objectStore(META).put(meta);
      tx.objectStore(THREADS).put({
        key: k(scope, thread.id),
        scope,
        thread,
      } satisfies ThreadRecord);
      await done(tx);
      await threadStore.prune(scope);
    } catch {
      /* best effort */
    }
  },

  async remove(scope: string, id: string): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction([META, THREADS], "readwrite");
      tx.objectStore(META).delete(k(scope, id));
      tx.objectStore(THREADS).delete(k(scope, id));
      await done(tx);
    } catch {
      /* best effort */
    }
  },

  async prune(scope: string): Promise<void> {
    const all = await threadStore.list(scope);
    const extra = all.slice(MAX_THREADS_PER_SCOPE);
    for (const t of extra) await threadStore.remove(scope, t.id);
  },
};
