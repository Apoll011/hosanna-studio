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
 * Notify listeners for a collection.
 *
 * If `changedIds` is provided, notifies the collection scope ("*") AND the
 * specific doc-level listeners for each changed ID.
 * If `changedIds` is omitted, notifies the collection scope ("*") and all doc
 * listeners for this collection (e.g. after a full collection wipe).
 */
export function notifyCollection(
  collection: string,
  changedIds?: readonly string[],
): void {
  // Always notify collection-level subscribers (queries like find())
  const colSet = listeners.get(busKey(collection, "*"));
  if (colSet) {
    for (const fn of Array.from(colSet)) fn();
  }

  if (changedIds) {
    // Notify specific doc-level listeners for each changed ID
    for (const id of changedIds) {
      const docSet = listeners.get(busKey(collection, id));
      if (docSet) {
        for (const fn of Array.from(docSet)) fn();
      }
    }
  } else {
    // If changedIds is omitted, notify all listeners for this collection
    const prefix = `${collection}:`;
    const fired = new Set<Set<Listener>>();
    if (colSet) fired.add(colSet);

    for (const [key, set] of listeners) {
      if (key.startsWith(prefix)) {
        if (!fired.has(set)) {
          fired.add(set);
          for (const fn of Array.from(set)) fn();
        }
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

/**
 * Fired with the *pre-write* document immediately before a local put overwrites
 * it. Replication uses this to seed assumedMasterState / field-diff baselines
 * after a page refresh when the persisted server-state cache has no entry yet.
 */
type BaselineListener = (previousDoc: Record<string, unknown>) => void;
const pushBaselineListeners = new Map<string, Set<BaselineListener>>();

export function subscribePushBaseline(
  collection: string,
  fn: BaselineListener,
): () => void {
  let set = pushBaselineListeners.get(collection);
  if (!set) {
    set = new Set();
    pushBaselineListeners.set(collection, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) pushBaselineListeners.delete(collection);
  };
}

export function notifyPushBaseline(
  collection: string,
  previousDoc: Record<string, unknown>,
): void {
  const set = pushBaselineListeners.get(collection);
  if (!set) return;
  for (const fn of Array.from(set)) fn(previousDoc);
}
