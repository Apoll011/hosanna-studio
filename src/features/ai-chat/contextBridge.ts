/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServiceElement } from "@/src/types";

export type SongEditorBridge = {
  songId: string;
  title: string;
  content: string;
} | null;

export type ServiceEditorBridge = {
  serviceId: string;
  title: string;
  elements: ServiceElement[];
} | null;

let songBridge: SongEditorBridge = null;
let serviceBridge: ServiceEditorBridge = null;

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
};

/** Stage a proposal in the song editor (accept/decline UI). */
export const AI_STAGE_SONG_EVENT = "hosanna:ai-stage-song";
export const AI_STAGE_SERVICE_EVENT = "hosanna:ai-stage-service";
export const AI_SETTINGS_CHANGED_EVENT = "hosanna:ai-settings-changed";

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

// Back-compat aliases used by older imports
export const AI_APPLY_SONG_EVENT = AI_STAGE_SONG_EVENT;
export const AI_APPLY_SERVICE_EVENT = AI_STAGE_SERVICE_EVENT;
export type AiApplySongDetail = AiStageSongDetail;
export type AiApplyServiceDetail = AiStageServiceDetail;
export const dispatchApplySong = dispatchStageSong;
export const dispatchApplyService = dispatchStageService;
