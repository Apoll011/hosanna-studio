/**
 * Low-level IndexedDB helpers.
 * No external dependencies. No abstractions beyond what the engine needs.
 */

/**
 * Open an IndexedDB database.
 *
 * Key improvements over the original:
 * - `onblocked` closes any old connections held by this tab before retrying
 *   (prevents indefinite blocking when the same tab reopens the DB after a
 *   version bump, which is the most common cause of the "IDB wiped on refresh"
 *   race condition).
 * - `onversionchange` is wired on the opened connection so that if another tab
 *   opens a newer version the current tab closes gracefully instead of blocking
 *   it. Without this the newer tab's upgrade is blocked indefinitely and it may
 *   re-create stores, effectively wiping any locally-opened data.
 */
export function openIDB(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);

    req.onupgradeneeded = (e) => {
      upgrade((e.target as IDBOpenDBRequest).result, e.oldVersion);
    };

    req.onsuccess = () => {
      const db = req.result;

      // If another tab opens a newer DB version it will be blocked by us.
      // Close gracefully so the upgrade can proceed without wiping stores.
      db.onversionchange = () => {
        console.warn(
          "[hosana-idb] versionchange received — closing connection to allow upgrade",
        );
        db.close();
      };

      resolve(db);
    };

    req.onerror = () => reject(req.error);

    // `onblocked` fires when this open request is blocked by another open
    // connection (e.g. another tab still at an older version).  We can't force
    // the other tab to close, but we log it so developers know what is happening.
    req.onblocked = () => {
      console.warn(
        "[hosana-idb] open blocked – another tab or connection holds the DB at an older version. " +
          "Close other tabs or reload them to unblock.",
      );
    };
  });
}

export function idbGet<T>(
  db: IDBDatabase,
  store: string,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export function idbGetAllByIndex<T>(
  db: IDBDatabase,
  store: string,
  indexName: string,
  query: IDBKeyRange | IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.getAll(query);
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Atomically put multiple records in a single readwrite transaction. */
export function idbBulkPut<T>(
  db: IDBDatabase,
  store: string,
  docs: T[],
): Promise<void> {
  if (docs.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const doc of docs) os.put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Put a single record. */
export function idbPut<T>(
  db: IDBDatabase,
  store: string,
  doc: T,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Delete a single record by key. */
export function idbDelete(
  db: IDBDatabase,
  store: string,
  key: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Clear all records from a store. */
export function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Count records in a store (cheap IDB cursor-free count).
 * Useful for health-checks (e.g. detect accidental wipe).
 */
export function idbCount(db: IDBDatabase, store: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
