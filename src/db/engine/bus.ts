/**
 * Reactive subscription bus.
 *
 * All subscribers are grouped by (collection, queryKey).
 * When a write lands, only the relevant subscribers are notified.
 * This keeps subscriptions granular and avoids full-table fan-out.
 */

export type Listener = () => void;

/** Global bus for all collection change events. */
const listeners = new Map<string, Set<Listener>>();

function busKey(collection: string, scope: string): string {
  return `${collection}:${scope}`;
}

/** Subscribe to all changes for a collection (scope="*") or a specific doc id. */
export function subscribe(
  collection: string,
  scope: string,
  fn: Listener,
): () => void {
  const k = busKey(collection, scope);
  let set = listeners.get(k);
  if (!set) {
    set = new Set();
    listeners.set(k, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(k);
  };
}

/** Notify listeners for a specific document and for the whole-collection scope. */
export function notify(collection: string, id: string): void {
  // Notify doc-level subscribers
  const docSet = listeners.get(busKey(collection, id));
  if (docSet) {
    for (const fn of docSet) fn();
  }
  // Notify collection-level subscribers (queries)
  const colSet = listeners.get(busKey(collection, "*"));
  if (colSet) {
    for (const fn of colSet) fn();
  }
}

/** Notify all listeners for a collection (used after bulk writes). */
export function notifyCollection(collection: string): void {
  const colSet = listeners.get(busKey(collection, "*"));
  if (colSet) {
    for (const fn of colSet) fn();
  }
  // Also notify any per-doc subscribers that might need updating
  for (const [key, set] of listeners) {
    if (key.startsWith(`${collection}:`)) {
      for (const fn of set) fn();
    }
  }
}

/**
 * Separate bus for LOCAL writes only (insert/upsert/patch) — used to trigger
 * immediate push-on-save. Deliberately NOT fired for writes that originate
 * from replication itself (_mergeFromServer), otherwise every pull would
 * schedule another push/pull cycle and the two would feed each other.
 */
const localChangeListeners = new Map<string, Set<Listener>>();

export function subscribeLocalChange(
  collection: string,
  fn: Listener,
): () => void {
  let set = localChangeListeners.get(collection);
  if (!set) {
    set = new Set();
    localChangeListeners.set(collection, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) localChangeListeners.delete(collection);
  };
}

export function notifyLocalChange(collection: string): void {
  const set = localChangeListeners.get(collection);
  if (set) {
    for (const fn of set) fn();
  }
}
