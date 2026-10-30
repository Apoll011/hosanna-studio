/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServiceElement } from "@/src/types";

export type SongEditorBridge = {
  songId: string;
  title: string;
  content: string;
  updatedAt?: string;
  folderId?: string | null;
  artist?: string;
} | null;

export type ServiceEditorBridge = {
  serviceId: string;
  title: string;
  elements: ServiceElement[];
  updatedAt?: string;
  notes?: string;
  date?: string;
} | null;

export type ExplorerBridge = {
  folderId: string | null;
  collectionId?: string | null;
  selectedSongIds?: string[];
  selectedFolderIds?: string[];
} | null;

let songBridge: SongEditorBridge = null;
let serviceBridge: ServiceEditorBridge = null;
let explorerBridge: ExplorerBridge = null;

const bridgeListeners = new Set<() => void>();

function notifyBridge() {
  bridgeListeners.forEach((fn) => fn());
}

export const aiContextBridge = {
  setSong(value: SongEditorBridge) {
    songBridge = value;
    notifyBridge();
  },
  getSong() {
    return songBridge;
  },
  setService(value: ServiceEditorBridge) {
    serviceBridge = value;
    notifyBridge();
  },
  getService() {
    return serviceBridge;
  },
  setExplorer(value: ExplorerBridge) {
    explorerBridge = value;
    notifyBridge();
  },
  getExplorer() {
    return explorerBridge;
  },
  /** Subscribe to any bridge change (editor typing, selection, navigation). */
  subscribe(listener: () => void) {
    bridgeListeners.add(listener);
    return () => {
      bridgeListeners.delete(listener);
    };
  },
};

export const AI_SETTINGS_CHANGED_EVENT = "hosanna:ai-settings-changed";
export const AI_LIBRARY_CHANGED_EVENT = "hosanna:ai-library-changed";
export const AI_NAVIGATE_EVENT = "hosanna:ai-navigate";
export const AI_PRINT_EVENT = "hosanna:ai-print";

export function dispatchAiSettingsChanged() {
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT));
}

export function dispatchLibraryChanged(detail?: {
  action?: string;
  id?: string;
}) {
  window.dispatchEvent(
    new CustomEvent(AI_LIBRARY_CHANGED_EVENT, { detail: detail ?? {} }),
  );
}

export type AiNavigateDetail = {
  kind: string;
  id?: string | null;
  route?: string;
  reason?: string;
};

export type AiPrintDetail = {
  kind: string;
  ids: string[];
  title?: string;
  options?: Record<string, unknown>;
  reason?: string;
};

export function dispatchAiNavigate(detail: AiNavigateDetail) {
  window.dispatchEvent(new CustomEvent(AI_NAVIGATE_EVENT, { detail }));
}

export function dispatchAiPrint(detail: AiPrintDetail) {
  window.dispatchEvent(new CustomEvent(AI_PRINT_EVENT, { detail }));
}
