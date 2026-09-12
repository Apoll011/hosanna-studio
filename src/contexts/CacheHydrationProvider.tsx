/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { getDatabase } from "../db";
import { isDemoMode } from "../demo/index";
import { useAuth } from "./AuthContext";

interface Props {
  children: React.ReactNode;
}

/**
 * CacheHydrationProvider
 *
 * Responsibilities:
 *  1. On logout: clear ALL local collections so stale data from a previous
 *     user session never leaks into the next session.
 *
 * What it does NOT do (and why):
 *  - It no longer triggers an initial sync on login. SyncContext.SyncProvider
 *    already calls `repl.start()` which runs an immediate sync. Triggering a
 *    second sync here would race with the first and double-push any pending
 *    local changes.
 */
export const CacheHydrationProvider: React.FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // Track previous auth state to detect logout transitions
  const prevAuthRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (isDemoMode()) {
      // Demo data is ephemeral — never clear on "logout"
      prevAuthRef.current = isAuthenticated;
      return;
    }

    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    // Only act on a genuine logout transition (true → false).
    // Skip on the very first render (prevAuthRef is still undefined).
    if (wasAuthenticated === true && !isAuthenticated) {
      void (async () => {
        try {
          const db = await getDatabase();
          // Clear ALL collections — including collections and agendaEvents
          // which were previously missing and could leak data between users.
          await Promise.all([
            db.songs.remove(),
            db.folders.remove(),
            db.collections.remove(),
            db.services.remove(),
            db.agendaEvents.remove(),
          ]);
        } catch {
          // Ignore — DB may not be initialized (e.g. logout before DB opens)
        }
      })();
    }
  }, [isAuthenticated]);

  return <>{children}</>;
};
