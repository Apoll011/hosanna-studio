/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useSyncExternalStore } from "react";

export interface PreviewSettings {
  showChords: boolean;
  transposeVal: number;
  fontSize: number;
  instrument: "guitar" | "piano" | "ukulele";
  showDiagrams: boolean;
  showYoutubePlayer: boolean;
}

const DEFAULT_SETTINGS: PreviewSettings = {
  showChords: true,
  transposeVal: 0,
  fontSize: 16,
  instrument: "guitar",
  showDiagrams: true,
  showYoutubePlayer: false,
};

const STORAGE_KEY = "chordpro-preview-settings";

function loadSettings(): PreviewSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Module-level store: every hook instance reads/writes the same state,
// so a change in one component is immediately visible in all others.
let state: PreviewSettings = loadSettings();
const listeners = new Set<() => void>();

function setState(updater: (prev: PreviewSettings) => PreviewSettings) {
  state = updater(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — silently ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

// Sync across tabs/windows on the same origin
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = { ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) };
        listeners.forEach((l) => l());
      } catch {
        // ignore invalid JSON from another tab
      }
    }
  });
}

export function usePreviewSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const updateSetting = useCallback(
    <K extends keyof PreviewSettings>(key: K, value: PreviewSettings[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => setState(() => DEFAULT_SETTINGS), []);

  return { settings, updateSetting, resetSettings };
}
