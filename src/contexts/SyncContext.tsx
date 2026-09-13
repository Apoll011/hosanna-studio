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
import { getDatabase, resetReplication, setupReplication } from "../db";
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
}

interface ShowToastOptions {
  type?: ToastMessage["type"];
  title?: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
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
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
    return () => {
      for (const timer of toastTimersRef.current.values()) {
        clearTimeout(timer);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  const { isAuthenticated } = useAuth();

  // Initialise database and replication on mount / auth change.
  //
  // Key correctness invariants:
  //  1. We call `resetReplication()` synchronously before the async `getDatabase()`
  //     so any *previous* manager is torn down immediately, not after an await.
  //  2. The `isMounted` guard prevents double-setup when StrictMode double-invokes
  //     the effect — the cleanup sets it to false before the second run starts.
  //  3. The subscription `sub` is stored in a local variable scoped to this
  //     effect invocation; the cleanup always unsubscribes the *correct* sub even
  //     if a concurrent async init is still in flight.
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

        const repl = setupReplication(db);
        replicationManagerRef.current = repl;

        sub = repl.status$.subscribe((st) => {
          // Map replication states to SyncStatus
          setSyncStatus(st as unknown as SyncStatus);
          if (st === "synced") {
            setLastSyncedAt(new Date());
          }
        });

        if (isAuthenticated) {
          repl.start();
        }
        // If not authenticated, don't start — the CacheHydrationProvider
        // logout handler will clear collections; next auth change re-enters here.
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
  }, [isAuthenticated]);

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
