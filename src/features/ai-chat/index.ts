/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export { AiChatDock } from "./AiChatDock";
export { AiChatProvider, useAiChat, useAiChatOptional } from "./AiChatProvider";
export { AiChatToggle } from "./AiChatToggle";
export { LogosMascot } from "./LogosMascot";
export { AiProposalBanner } from "./AiProposalBanner";
export { AiConfirmCard } from "./AiConfirmCard";
export {
  AI_LIBRARY_CHANGED_EVENT,
  AI_NAVIGATE_EVENT,
  AI_PRINT_EVENT,
  AI_SETTINGS_CHANGED_EVENT,
  aiContextBridge,
  dispatchAiNavigate,
  dispatchAiPrint,
  dispatchAiSettingsChanged,
  dispatchLibraryChanged,
  type AiNavigateDetail,
  type AiPrintDetail,
} from "./contextBridge";
export {
  aiProposals,
  useAiProposals,
  useServiceProposal,
  useSongProposal,
  useSongProposalStatus,
  type ProposalStatus,
  type AiProposal,
  type ServiceProposal,
  type SongProposal,
} from "./proposalStore";
export { DIFF_THEME_STYLE, useDiffLabels } from "./proposalDiff";
export { shouldStudioSyncAfterTool } from "./studioSync";
