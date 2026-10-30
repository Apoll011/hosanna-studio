/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from "react";
import { aiContextBridge } from "./contextBridge";

/** Key of the editor currently open (`song:<id>` / `service:<id>`), if any. */
function openEditorKey(): string {
  const song = aiContextBridge.getSong();
  if (song) return `song:${song.songId}`;
  const service = aiContextBridge.getService();
  if (service) return `service:${service.serviceId}`;
  return "";
}

export function useOpenEditorKey(): string {
  return useSyncExternalStore(
    aiContextBridge.subscribe,
    openEditorKey,
    openEditorKey,
  );
}
