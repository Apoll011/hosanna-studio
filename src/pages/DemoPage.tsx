/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Spinner } from "@/src/components/common";
import React, { useEffect, useRef, useState } from "react";
import { getDatabase } from "../db";
import { clearDemoData, enableDemoMode, DEMO_ORG_SLUG } from "../demo/index";
import { seedDemoDatabase } from "../demo/seedDemoDatabase";

/**
 * The `/demo` entry point.
 *
 * 1. Clears any stale demo data / singletons from a previous demo session.
 * 2. Sets the `isDemo` sessionStorage flag.
 * 3. Opens the local IndexedDB database fresh and seeds it with demo data.
 * 4. Hard-navigates to `/<demo-slug>/folders` so the full auth/routing
 *    stack re-boots with demo mode active.
 */
export const DemoPage: React.FC = () => {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function initDemo() {
      try {
        // Wipe any previous demo session (stale IDB + singletons) before starting fresh.
        await clearDemoData();

        // Activate demo mode before doing anything else so that the
        // re-booted app can detect it immediately.
        enableDemoMode();

        const locale =
          (typeof navigator !== "undefined" && navigator.language) || "pt";

        const db = await getDatabase();
        await seedDemoDatabase(db, locale);

        // Hard navigation so App.tsx re-mounts with isDemoMode() === true.
        window.location.replace(`/${DEMO_ORG_SLUG}/folders`);
      } catch (err) {
        console.error("[Demo] Failed to initialise demo mode:", err);
        setStatus("error");
      }
    }

    void initDemo();
  }, []);

  if (status === "error") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-m3-bg text-m3-on-bg">
        <p className="text-lg font-medium">
          Failed to start demo. Please try again.
        </p>
        <button
          className="px-4 py-2 rounded-md bg-m3-primary text-m3-on-primary text-sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-m3-bg">
      <Spinner size="lg" />
      <p className="text-sm text-m3-on-bg/60">Starting demo…</p>
    </div>
  );
};
