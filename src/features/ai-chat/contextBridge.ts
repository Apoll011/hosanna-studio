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

export const AI_APPLY_SONG_EVENT = "hosanna:ai-apply-song";
export const AI_APPLY_SERVICE_EVENT = "hosanna:ai-apply-service";
export const AI_SETTINGS_CHANGED_EVENT = "hosanna:ai-settings-changed";

export function dispatchAiSettingsChanged() {
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT));
}

export type AiApplySongDetail = {
  songId?: string;
  content: string;
  title?: string;
  artist?: string;
};

export type AiApplyServiceDetail = {
  serviceId?: string;
  name?: string;
  notes?: string;
  elements: ServiceElement[];
};

export function dispatchApplySong(detail: AiApplySongDetail) {
  window.dispatchEvent(new CustomEvent(AI_APPLY_SONG_EVENT, { detail }));
}

export function dispatchApplyService(detail: AiApplyServiceDetail) {
  window.dispatchEvent(new CustomEvent(AI_APPLY_SERVICE_EVENT, { detail }));
}
