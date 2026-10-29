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

export const aiContextBridge = {
  setSong(value: SongEditorBridge) {
    songBridge = value;
  },
  getSong() {
    return songBridge;
  },
  setService(value: ServiceEditorBridge) {
    serviceBridge = value;
  },
  getService() {
    return serviceBridge;
  },
  setExplorer(value: ExplorerBridge) {
    explorerBridge = value;
  },
  getExplorer() {
    return explorerBridge;
  },
};

/** Stage a proposal in the song editor (accept/decline UI). */
export const AI_STAGE_SONG_EVENT = "hosanna:ai-stage-song";
export const AI_STAGE_SERVICE_EVENT = "hosanna:ai-stage-service";
export const AI_SETTINGS_CHANGED_EVENT = "hosanna:ai-settings-changed";
export const AI_LIBRARY_CHANGED_EVENT = "hosanna:ai-library-changed";
export const AI_NAVIGATE_EVENT = "hosanna:ai-navigate";
export const AI_PRINT_EVENT = "hosanna:ai-print";

export type AiStageSongDetail = {
  songId?: string;
  content: string;
  title?: string;
  artist?: string;
  diffPreview?: string;
  source?: string;
};

export type AiStageServiceDetail = {
  serviceId?: string;
  name?: string;
  notes?: string;
  elements: ServiceElement[];
  source?: string;
};

export function dispatchStageSong(detail: AiStageSongDetail) {
  window.dispatchEvent(new CustomEvent(AI_STAGE_SONG_EVENT, { detail }));
}

export function dispatchStageService(detail: AiStageServiceDetail) {
  window.dispatchEvent(new CustomEvent(AI_STAGE_SERVICE_EVENT, { detail }));
}

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

// Back-compat aliases used by older imports
export const AI_APPLY_SONG_EVENT = AI_STAGE_SONG_EVENT;
export const AI_APPLY_SERVICE_EVENT = AI_STAGE_SERVICE_EVENT;
export type AiApplySongDetail = AiStageSongDetail;
export type AiApplyServiceDetail = AiStageServiceDetail;
export const dispatchApplySong = dispatchStageSong;
export const dispatchApplyService = dispatchStageService;
