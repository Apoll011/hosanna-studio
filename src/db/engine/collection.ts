/**
 * Hosana Collection — the core engine.
 *
 * Implements just the API surface Hosana actually uses:
 *   collection.find({selector}).exec()
 *   collection.find({selector}).$.subscribe(docs => …)
 *   collection.findOne(id).exec()
 *   collection.findOne(id).$.subscribe(doc => …)
 *   collection.insert(doc)
 *   collection.upsert(doc)
 *   collection.bulkInsert(docs)
 *   collection.remove()              ← wipe entire collection (logout)
 *   doc.patch(partial)
 *   doc.remove()                     ← hard-delete (replication tombstone)
 *   doc.toJSON()
 *   doc[field]                       ← direct property access (via intersection type)
 *
 * Selector support — exactly what Hosana uses:
 *   { field: value }                 ← equality (incl. null)
 *   { field: { $ne: value } }        ← not-equal
 *   { field: { $lte: value, $ne: null } }
 *   { field: { $gte: value } }
 *   { field: { $in: [...] } }
 *
 * All queries run against the in-memory store (fast; collections are small).
 * IndexedDB is used only for persistence.
 */

import { idbBulkPut, idbClear, idbDelete, idbGetAll, idbPut } from "./idb";
import { notify, notifyCollection, subscribe as busSubscribe } from "./bus";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnyDoc = { id: string } & Record<string, unknown>;
export type Selector = Record<string, unknown>;

export interface FindOptions {
  selector: Selector;
}

export interface Subscription {
  unsubscribe: () => void;
}

export interface Observable<T> {
  subscribe: (fn: (value: T) => void) => Subscription;
}

export interface LiveQuery<T> {
  exec(): Promise<T[]>;
  $: Observable<T[]>;
}

export interface LiveDocument<T> {
  exec(): Promise<T | null>;
  $: Observable<T | null>;
}

// ─── Document wrapper ─────────────────────────────────────────────────────────
//
// HosanaDoc<T> = T & { patch, remove, toJSON }
//
// We cannot `class Foo extends T {}` in TS, so we build the wrapper as a
// plain object intersection. The factory `makeDoc(raw, collection)` returns
// an object that IS the raw doc (via Object.assign) augmented with the three
// mutation methods, giving full property access (doc.title, doc.id, etc.)
// and the mutation surface (doc.patch, doc.remove, doc.toJSON).

export type HosanaDoc<T extends AnyDoc> = T & {
  /** Partially update this document. */
  patch(fields: Partial<T>): Promise<void>;
  /** Hard-delete this document (sets replication tombstone). */
  remove(): Promise<void>;
  /** Return a plain clone of the document data. */
  toJSON(): T;
  /** @internal — back-reference, hidden from callers by convention */
  _collection: HosanaCollection<T>;
  /** @internal */
  _raw: T;
};

function makeDoc<T extends AnyDoc>(
  raw: T,
  collection: HosanaCollection<T>,
): HosanaDoc<T> {
  const doc = Object.assign(Object.create(null) as object, raw) as HosanaDoc<T>;

  // Store references to the mutable collection so patch/remove can call back.
  // Use non-enumerable properties so toJSON() spread doesn't pick them up.
  Object.defineProperty(doc, "_collection", {
    value: collection,
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(doc, "_raw", {
    value: raw,
    enumerable: false,
    writable: true,
  });

  doc.toJSON = function (this: HosanaDoc<T>): T {
    const out = { ...this._raw };
    delete (out as Record<string, unknown>)["__tombstone"];
    return out;
  };

  doc.patch = async function (
    this: HosanaDoc<T>,
    fields: Partial<T>,
  ): Promise<void> {
    const next = { ...this._raw, ...fields } as T;
    await this._collection._put(next);
    // Update own properties to reflect new state
    Object.assign(this, fields);
    (this as { _raw: T })._raw = next;
  };

  doc.remove = async function (this: HosanaDoc<T>): Promise<void> {
    const id = this._raw.id;
    // Remove from memory
    this._collection._storeDelete(id);
    // Remove from IDB
    await idbDelete(this._collection._db, this._collection._storeName, id);
    notify(this._collection._storeName, id);
  };

  return doc;
}

// ─── Selector matching ────────────────────────────────────────────────────────

function matchesSelector<T extends AnyDoc>(
  doc: T,
  selector: Selector,
): boolean {
  for (const [key, condition] of Object.entries(selector)) {
    const docVal = (doc as Record<string, unknown>)[key];
    if (condition !== null && typeof condition === "object") {
      const cond = condition as Record<string, unknown>;
      if ("$ne" in cond && docVal === cond["$ne"]) return false;
      if ("$lte" in cond) {
        if (docVal == null || docVal > (cond["$lte"] as unknown)) return false;
      }
      if ("$gte" in cond) {
        if (docVal == null || docVal < (cond["$gte"] as unknown)) return false;
      }
      if ("$in" in cond) {
        const arr = cond["$in"] as unknown[];
        if (!arr.includes(docVal)) return false;
      }
    } else {
      // Equality (incl. null)
      if (docVal !== condition) return false;
    }
  }
  return true;
}

// ─── Collection ───────────────────────────────────────────────────────────────

export class HosanaCollection<T extends AnyDoc> {
  /** In-memory cache: id → raw doc */
  private _store = new Map<string, T>();
  /** @internal */ readonly _db: IDBDatabase;
  /** @internal */ readonly _storeName: string;
  private readonly _localFields: Set<string>;
  private readonly _computedFields: Record<string, (doc: T) => unknown>;

  constructor(
    db: IDBDatabase,
    storeName: string,
    initialDocs: T[],
    options: {
      localFields?: string[];
      computedFields?: Record<string, (doc: T) => unknown>;
    } = {},
  ) {
    this._db = db;
    this._storeName = storeName;
    this._localFields = new Set(options.localFields ?? []);
    this._computedFields = options.computedFields ?? {};
    for (const doc of initialDocs) {
      this._store.set(doc.id, this._applyComputedFields(doc));
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /** @internal Used by doc.remove() */
  _storeDelete(id: string): void {
    this._store.delete(id);
  }

  /** @internal Put a raw record into memory + IDB and fire the bus. */
  async _put(doc: T): Promise<void> {
    const enriched = this._applyComputedFields(doc);
    this._store.set(enriched.id, enriched);
    await idbPut(this._db, this._storeName, enriched);
    notify(this._storeName, enriched.id);
  }

  /** @internal Put a batch; single IDB transaction. */
  async _putBatch(docs: T[]): Promise<void> {
    const enriched = docs.map((d) => this._applyComputedFields(d));
    for (const d of enriched) {
      this._store.set(d.id, d);
    }
    await idbBulkPut(this._db, this._storeName, enriched);
    notifyCollection(this._storeName);
  }

  /**
   * @internal Merge a doc from the server, preserving local-only fields.
   * Computed fields are recalculated.
   */
  async _mergeFromServer(serverDoc: T): Promise<void> {
    const existing = this._store.get(serverDoc.id);
    let merged: T = serverDoc;
    if (existing && this._localFields.size > 0) {
      const overrides: Partial<T> = {};
      for (const lf of this._localFields) {
        if (lf in existing) {
          (overrides as Record<string, unknown>)[lf] = (
            existing as Record<string, unknown>
          )[lf];
        }
      }
      merged = { ...serverDoc, ...overrides };
    }
    await this._put(merged);
  }

  private _applyComputedFields(doc: T): T {
    if (Object.keys(this._computedFields).length === 0) return doc;
    const out = { ...doc };
    for (const [field, fn] of Object.entries(this._computedFields)) {
      try {
        (out as Record<string, unknown>)[field] = fn(doc);
      } catch {
        // computed field errors must not break writes
      }
    }
    return out as T;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  find(opts: FindOptions): LiveQuery<HosanaDoc<T>> {
    const { selector } = opts;
    const execNow = (): HosanaDoc<T>[] =>
      Array.from(this._store.values())
        .filter((d) => matchesSelector(d, selector))
        .map((d) => makeDoc(d, this));

    return {
      exec: async () => execNow(),
      $: {
        subscribe: (fn: (docs: HosanaDoc<T>[]) => void): Subscription => {
          fn(execNow());
          const unsub = busSubscribe(this._storeName, "*", () => fn(execNow()));
          return { unsubscribe: unsub };
        },
      },
    };
  }

  findOne(id: string): LiveDocument<HosanaDoc<T>> {
    const execNow = (): HosanaDoc<T> | null => {
      const raw = this._store.get(id);
      return raw ? makeDoc(raw, this) : null;
    };

    return {
      exec: async () => execNow(),
      $: {
        subscribe: (fn: (doc: HosanaDoc<T> | null) => void): Subscription => {
          fn(execNow());
          const unsubDoc = busSubscribe(this._storeName, id, () =>
            fn(execNow()),
          );
          return { unsubscribe: unsubDoc };
        },
      },
    };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async insert(doc: T): Promise<HosanaDoc<T>> {
    if (this._store.has(doc.id)) {
      throw new Error(
        `[hosana-idb] "${doc.id}" already exists in "${this._storeName}"`,
      );
    }
    await this._put(doc);
    return makeDoc(this._store.get(doc.id)!, this);
  }

  async upsert(doc: T): Promise<HosanaDoc<T>> {
    const existing = this._store.get(doc.id);
    let merged = doc;
    if (existing && this._localFields.size > 0) {
      const overrides: Partial<T> = {};
      for (const lf of this._localFields) {
        if (lf in existing) {
          (overrides as Record<string, unknown>)[lf] = (
            existing as Record<string, unknown>
          )[lf];
        }
      }
      merged = { ...doc, ...overrides };
    }
    await this._put(merged);
    return makeDoc(this._store.get(doc.id)!, this);
  }

  async bulkInsert(
    docs: T[],
  ): Promise<{ success: HosanaDoc<T>[]; error: T[] }> {
    const success: HosanaDoc<T>[] = [];
    const error: T[] = [];
    const toWrite: T[] = [];

    for (const doc of docs) {
      if (this._store.has(doc.id)) {
        error.push(doc);
      } else {
        toWrite.push(doc);
      }
    }

    if (toWrite.length > 0) {
      await this._putBatch(toWrite);
      for (const doc of toWrite) {
        success.push(makeDoc(this._store.get(doc.id)!, this));
      }
    }

    return { success, error };
  }

  /** Wipe all data from this collection (used on logout). */
  async remove(): Promise<void> {
    this._store.clear();
    await idbClear(this._db, this._storeName);
    notifyCollection(this._storeName);
  }

  /** Raw access for replication — all docs as plain objects. */
  getAllRaw(): T[] {
    return Array.from(this._store.values());
  }

  /** Raw access for replication — single raw doc. */
  getRaw(id: string): T | undefined {
    return this._store.get(id);
  }
}

// ─── Helpers for idbGetAll (needed by database.ts) ───────────────────────────
// Re-export so database.ts has a single internal import path.
export { idbGetAll };
