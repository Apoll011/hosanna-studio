/**
 * Reactive subscription bus.
 *
 * All subscribers are grouped by (collection, queryKey).
 * When a write lands, only the relevant subscribers are notified.
 * This keeps subscriptions granular and avoids full-table fan-out.
 *
 * Improvements over the original:
 * - `notifyCollection` no longer double-fires the "*" scope; it iterates the
 *   internal listeners map once and only notifies each listener set exactly once.
 * - All exported functions are pure and have no side-effects beyond the intended
 *   subscription / notification.
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

/**
 * Notify listeners for a specific document AND for the whole-collection scope.
 *
 * Bug fix: iterate over a snapshot of each Set before calling listeners so that
 * a listener that synchronously unsubscribes during notification does not cause
 * a skipped or double-fired callback.
 */
export function notify(collection: string, id: string): void {
  // Notify doc-level subscribers
  const docSet = listeners.get(busKey(collection, id));
  if (docSet) {
    for (const fn of Array.from(docSet)) fn();
  }
  // Notify collection-level subscribers (queries)
  const colSet = listeners.get(busKey(collection, "*"));
  if (colSet) {
    for (const fn of Array.from(colSet)) fn();
  }
}

/**
 * Notify all listeners for a collection (used after bulk writes).
 *
 * Bug fix (original): the old implementation iterated ALL keys and also fired
 * the "*" scope set twice (once via the prefix check, once explicitly above it).
 * This rewrite collects each unique Set exactly once.
 */
export function notifyCollection(collection: string): void {
  const prefix = `${collection}:`;
  // Use a Set of Sets to deduplicate — each listener set fires exactly once.
  const fired = new Set<Set<Listener>>();

  for (const [key, set] of listeners) {
    if (key.startsWith(prefix)) {
      if (!fired.has(set)) {
        fired.add(set);
        for (const fn of Array.from(set)) fn();
      }
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
    for (const fn of Array.from(set)) fn();
  }
}
