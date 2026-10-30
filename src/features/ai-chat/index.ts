/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export { AiChatDock } from "./AiChatDock";
export { AiChatPanel } from "./AiChatPanel";
export { AiChatProvider, useAiChat, useAiChatOptional } from "./AiChatProvider";
export { AiChatToggle } from "./AiChatToggle";
export { AiProposalBanner } from "./AiProposalBanner";
export { AiConfirmCard } from "./AiConfirmCard";
export {
  AI_APPLY_SERVICE_EVENT,
  AI_APPLY_SONG_EVENT,
  AI_LIBRARY_CHANGED_EVENT,
  AI_NAVIGATE_EVENT,
  AI_PRINT_EVENT,
  AI_SETTINGS_CHANGED_EVENT,
  AI_STAGE_SERVICE_EVENT,
  AI_STAGE_SONG_EVENT,
  aiContextBridge,
  dispatchAiNavigate,
  dispatchAiPrint,
  dispatchAiSettingsChanged,
  dispatchApplyService,
  dispatchApplySong,
  dispatchLibraryChanged,
  dispatchStageService,
  dispatchStageSong,
  type AiApplyServiceDetail,
  type AiApplySongDetail,
  type AiNavigateDetail,
  type AiPrintDetail,
  type AiStageServiceDetail,
  type AiStageSongDetail,
} from "./contextBridge";
export { shouldStudioSyncAfterTool } from "./studioSync";
