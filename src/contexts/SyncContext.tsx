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
import { getDatabase, ReplicationManager, resetReplication, setupReplication } from "../db";
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
  setSyncStatus: (status: SyncStatus) => void;
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

  const removeToast = useCallback((id: string) => {
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
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const { isAuthenticated } = useAuth();

  // Initialise database and replication on start / auth change
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    async function initDbAndSync() {
      try {
        const db = await getDatabase();
        if (!isMounted) return;

        // In demo mode, skip replication entirely — the DB is local-only.
        if (isDemoMode()) {
          setSyncStatus("local_only");
          return;
        }

        // Tear down any previous manager before creating a fresh one.
        // This handles logout → login cycles correctly.
        resetReplication();

        const repl = setupReplication(db);
        replicationManagerRef.current = repl;

        sub = repl.status$.subscribe((st) => {
          setSyncStatus(st);
          if (st === "synced") {
            setLastSyncedAt(new Date());
          }
        });

        if (isAuthenticated) {
          repl.start();
        } else {
          repl.stop();
        }
      } catch (err) {
        console.error("Failed to initialize RxDB / Replication:", err);
        setSyncStatus("error");
      }
    }

    void initDbAndSync();

    return () => {
      isMounted = false;
      if (sub) sub.unsubscribe();
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
        setSyncStatus,
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
