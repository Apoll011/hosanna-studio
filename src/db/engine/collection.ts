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

import { idbBulkDelete, idbBulkPut, idbClear, idbGetAll, idbPut } from "./idb";
import {
  notify,
  notifyCollection,
  notifyLocalChange,
  notifyPushBaseline,
  subscribe as busSubscribe,
} from "./bus";

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
    // Keep a local tombstone until replication successfully pushes `_deleted: true`
    // to the server. Hard-removing here would drop the delete and never sync it.
    const tombstone = { ...this._raw, _deleted: true } as T;
    await this._collection._put(tombstone);
    Object.assign(this, { _deleted: true });
    (this as { _raw: T })._raw =
      this._collection.getRaw(this._raw.id) ?? tombstone;
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
      if ("$ne" in cond) {
        if (cond["$ne"] === null) {
          if (docVal == null) return false;
        } else if (docVal === cond["$ne"]) {
          return false;
        }
      }
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
    } else if (condition === null) {
      // In document queries, matching null matches both null and undefined
      if (docVal != null) return false;
    } else {
      // Equality
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

  /** @internal Used by doc.remove() / replication */
  _storeDelete(id: string): void {
    this._store.delete(id);
  }

  /** @internal Local-only field names (never pushed to the server). */
  getLocalFieldNames(): ReadonlySet<string> {
    return this._localFields;
  }

  /**
   * @internal Put a raw record into memory + IDB and fire the bus.
   *
   * `origin` distinguishes a genuine local write (insert/upsert/patch) from a
   * write caused by replication itself (`_mergeFromServer`):
   *  - "local" (default): stamps `updatedAt` to now — this is what makes the
   *    checkpoint-based replication filter (see replication.ts) reliably pick
   *    up every local change, including trash/isDeleted flips, without
   *    depending on every call site remembering to bump `updatedAt` itself.
   *    Also fires `notifyLocalChange` so replication can push-on-save.
   *  - "remote": keeps the server-provided `updatedAt` verbatim (it's the
   *    conflict-detection field) and never fires `notifyLocalChange`, so a
   *    pull-triggered write can't loop back into another push/pull cycle.
   */
  async _put(doc: T, origin: "local" | "remote" = "local"): Promise<void> {
    // Capture pre-write snapshot before we overwrite — replication needs it
    // as the push baseline when the server-state cache is cold after a refresh.
    if (origin === "local") {
      const previous = this._store.get(doc.id);
      if (previous) {
        notifyPushBaseline(
          this._storeName,
          previous as unknown as Record<string, unknown>,
        );
      }
    }
    const stamped: T =
      origin === "local" && "updatedAt" in doc
        ? ({ ...doc, updatedAt: new Date().toISOString() } as T)
        : doc;
    const enriched = this._applyComputedFields(stamped);
    this._store.set(enriched.id, enriched);
    await idbPut(this._db, this._storeName, enriched);
    notify(this._storeName, enriched.id);
    if (origin === "local") notifyLocalChange(this._storeName);
  }

  /**
   * @internal Put a batch; single IDB transaction.
   * `origin` defaults to "local" (bulkInsert). Replication uses "remote".
   */
  async _putBatch(
    docs: T[],
    origin: "local" | "remote" = "local",
  ): Promise<void> {
    if (docs.length === 0) return;
    if (origin === "local") {
      for (const doc of docs) {
        const previous = this._store.get(doc.id);
        if (previous) {
          notifyPushBaseline(
            this._storeName,
            previous as unknown as Record<string, unknown>,
          );
        }
      }
    }
    const stamped =
      origin === "local"
        ? docs.map((d) =>
            "updatedAt" in d
              ? ({ ...d, updatedAt: new Date().toISOString() } as T)
              : d,
          )
        : docs;
    const enriched = stamped.map((d) => this._applyComputedFields(d));
    for (const d of enriched) {
      this._store.set(d.id, d);
    }
    await idbBulkPut(this._db, this._storeName, enriched);
    notifyCollection(
      this._storeName,
      enriched.map((d) => d.id),
    );
    if (origin === "local") notifyLocalChange(this._storeName);
  }

  /**
   * @internal Merge a doc from the server, preserving local-only fields.
   * If a local field is missing or null on the existing doc, it is (re)computed.
   * Computed fields are always recalculated.
   *
   * Drops stale server docs if local doc was updated more recently (e.g. edit during in-flight pull).
   */
  async _mergeFromServer(
    serverDoc: T,
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (!options.force) {
      const existing = this._store.get(serverDoc.id);
      if (
        existing &&
        typeof (existing as Record<string, unknown>).updatedAt === "string" &&
        typeof (serverDoc as Record<string, unknown>).updatedAt === "string" &&
        (existing as Record<string, unknown>).updatedAt >
          (serverDoc as Record<string, unknown>).updatedAt
      ) {
        return;
      }
    }
    await this._put(this._mergeLocalFields(serverDoc), "remote");
  }

  /**
   * @internal Batch-merge server docs in a single IDB transaction.
   * Much faster than N individual `_mergeFromServer` calls during pull.
   *
   * Drops stale server docs if local doc was updated more recently (e.g. edit during in-flight pull).
   */
  async _mergeBatchFromServer(
    serverDocs: T[],
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (serverDocs.length === 0) return;
    const force = options.force ?? false;
    const eligibleDocs = force
      ? serverDocs
      : serverDocs.filter((sDoc) => {
          const existing = this._store.get(sDoc.id);
          if (
            existing &&
            typeof (existing as Record<string, unknown>).updatedAt ===
              "string" &&
            typeof (sDoc as Record<string, unknown>).updatedAt === "string" &&
            (existing as Record<string, unknown>).updatedAt >
              (sDoc as Record<string, unknown>).updatedAt
          ) {
            return false;
          }
          return true;
        });

    if (eligibleDocs.length === 0) return;
    const merged = eligibleDocs.map((d) => this._mergeLocalFields(d));
    await this._putBatch(merged, "remote");
  }

  /**
   * @internal Hard-remove ids from memory + IDB after a tombstone was
   * acknowledged (local push success or server pull of `_deleted: true`).
   */
  async _purgeIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    for (const id of ids) this._store.delete(id);
    await idbBulkDelete(this._db, this._storeName, ids);
    notifyCollection(this._storeName, ids);
  }

  /** Preserve non-null local-only fields across a server merge. */
  private _mergeLocalFields(serverDoc: T): T {
    if (this._localFields.size === 0) return serverDoc;
    const existing = this._store.get(serverDoc.id);
    if (!existing) return serverDoc;
    const overrides: Partial<T> = {};
    for (const lf of this._localFields) {
      const existingVal = (existing as Record<string, unknown>)[lf];
      if (existingVal != null) {
        (overrides as Record<string, unknown>)[lf] = existingVal;
      }
    }
    return Object.keys(overrides).length > 0
      ? ({ ...serverDoc, ...overrides } as T)
      : serverDoc;
  }

  private _applyComputedFields(doc: T): T {
    if (Object.keys(this._computedFields).length === 0) return doc;
    const out = { ...doc };
    for (const [field, fn] of Object.entries(this._computedFields)) {
      const current = (out as Record<string, unknown>)[field];
      // Always recompute if the field is a localField (may have been preserved
      // with a stale value) OR if it's currently null/undefined.
      if (current != null && !this._localFields.has(field)) continue;
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
    if (this._localFields.size > 0) {
      const overrides: Partial<T> = {};
      for (const lf of this._localFields) {
        const existingVal = existing
          ? (existing as Record<string, unknown>)[lf]
          : undefined;
        if (existingVal != null) {
          (overrides as Record<string, unknown>)[lf] = existingVal;
        }
      }
      if (Object.keys(overrides).length > 0) {
        merged = { ...doc, ...overrides };
      }
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
