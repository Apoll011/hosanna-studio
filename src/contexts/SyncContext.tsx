/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ensureOrgScopedData,
  getDatabase,
  resetReplication,
  setupReplication,
} from "../db";
import type { ReplicationManager } from "../db";
import { SyncStatus } from "../types";
import { useAuth } from "./AuthContext";
import { isDemoMode } from "../demo/index";

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  text?: string;
  title?: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
  /** Fired when the toast is removed (X, action, or auto-dismiss). */
  onDismiss?: () => void;
}

interface ShowToastOptions {
  type?: ToastMessage["type"];
  title?: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
  onDismiss?: () => void;
}

interface SyncContextType {
  syncStatus: SyncStatus;
  toasts: ToastMessage[];
  showToast: (
    textOrOptions: string | ShowToastOptions,
    type?: ToastMessage["type"],
  ) => void;
  removeToast: (id: string) => void;
  triggerSyncCheck: () => Promise<void>;
  lastSyncedAt: Date | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const replicationManagerRef = useRef<ReplicationManager | null>(null);

  // Track auto-dismiss timers so they can be cleared on manual dismissal
  // and on unmount, preventing setState-after-unmount warnings.
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const removeToast = useCallback((id: string) => {
    // Cancel the auto-dismiss timer if the user dismisses manually
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => {
      const leaving = prev.find((t) => t.id === id);
      if (leaving?.onDismiss) {
        try {
          leaving.onDismiss();
        } catch {
          // ignore consumer errors
        }
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const showToast = useCallback(
    (
      textOrOptions: string | ShowToastOptions,
      type: ToastMessage["type"] = "info",
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let toastItem: ToastMessage;

      if (typeof textOrOptions === "string") {
        toastItem = { id, type, text: textOrOptions };
      } else {
        toastItem = {
          id,
          type: textOrOptions.type || "info",
          title: textOrOptions.title,
          description: textOrOptions.description,
          action: textOrOptions.action,
          duration: textOrOptions.duration,
          onDismiss: textOrOptions.onDismiss,
        };
      }

      setToasts((prev) => [...prev, toastItem]);

      const duration =
        toastItem.duration !== undefined ? toastItem.duration : 4000;
      if (duration > 0) {
        const timer = setTimeout(() => {
          toastTimersRef.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
        toastTimersRef.current.set(id, timer);
      }
    },
    // removeToast intentionally not in deps — we inline the filter here to
    // avoid capturing a stale removeToast that itself closes over stale state.
    [],
  );

  // Clear all pending toast timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const { isAuthenticated, organization } = useAuth();
  const orgSlug = organization?.slug ?? null;

  // Initialise database and replication on mount / auth / org change.
  //
  // Key correctness invariants:
  //  1. We call `resetReplication()` synchronously before the async `getDatabase()`
  //     so any *previous* manager is torn down immediately, not after an await.
  //  2. The `isMounted` guard prevents double-setup when StrictMode double-invokes
  //     the effect — the cleanup sets it to false before the second run starts.
  //  3. The subscription `sub` is stored in a local variable scoped to this
  //     effect invocation; the cleanup always unsubscribes the *correct* sub even
  //     if a concurrent async init is still in flight.
  //  4. Local data is stamped with the active org slug. A mismatch wipes the
  //     stores before any sync starts; sync is refused while slugs differ.
  useEffect(() => {
    // Tear down any previous manager immediately (synchronously)
    resetReplication();
    replicationManagerRef.current = null;

    let sub: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    async function initDbAndSync() {
      try {
        const db = await getDatabase();
        if (!isMounted) return;

        // In demo mode, skip replication entirely — the DB is local-only.
        if (isDemoMode()) {
          setSyncStatus("local_only" as SyncStatus);
          return;
        }

        const scope = await ensureOrgScopedData(db, orgSlug);
        if (!isMounted) return;

        // No active org (or scope still mismatched) — never start sync.
        if (!isAuthenticated || !scope.matched || !orgSlug) {
          return;
        }

        const repl = setupReplication(db, orgSlug);
        replicationManagerRef.current = repl;

        sub = repl.status$.subscribe((st) => {
          // Map replication states to SyncStatus
          setSyncStatus(st as unknown as SyncStatus);
          if (st === "synced") {
            setLastSyncedAt(new Date());
          }
        });

        repl.start({ forceFullPull: scope.cleared });
      } catch (err) {
        console.error(
          "[SyncContext] Failed to initialize DB / Replication:",
          err,
        );
        if (isMounted) setSyncStatus("error" as SyncStatus);
      }
    }

    void initDbAndSync();

    return () => {
      isMounted = false;
      if (sub) sub.unsubscribe();
      // Stop the manager on cleanup; resetReplication() at the top of the next
      // effect run handles full teardown.
      replicationManagerRef.current?.stop();
    };
  }, [isAuthenticated, orgSlug]);

  const triggerSyncCheck = useCallback(async () => {
    // No-op in demo mode — no server to sync with.
    if (isDemoMode()) return;
    if (replicationManagerRef.current) {
      await replicationManagerRef.current.replicateNow();
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        toasts,
        showToast,
        removeToast,
        triggerSyncCheck,
        lastSyncedAt,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
