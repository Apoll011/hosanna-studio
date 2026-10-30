/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiClient } from "./http";

export type AiProvider =
  "openai" | "anthropic" | "google" | "deepseek" | "openai_compatible";

export type NativeWebCapability = {
  search: boolean;
  fetch: boolean;
  note: string;
};

export type AiSettingsPublic = {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  configured: boolean;
  baseUrl: string | null;
  encryptionReady: boolean;
  providers: AiProvider[];
  modelPresets: Record<AiProvider, string[]>;
  defaultBaseUrls?: Partial<Record<AiProvider, string>>;
  /** All providers → whether Hosanna can call REST Search/Fetch with BYOK. */
  nativeWebCapabilities?: Record<AiProvider, NativeWebCapability>;
  /** Capability for the currently selected provider. */
  nativeWeb?: {
    search: boolean;
    fetch: boolean;
    note: string;
    active: boolean;
  };
};

export type AiChatContext = {
  kind?:
    | "song_editor"
    | "service_editor"
    | "songs_list"
    | "services_list"
    | "explorer"
    | "collection_detail"
    | "agenda"
    | "trash"
    | "general";
  route?: string;
  songId?: string;
  serviceId?: string;
  folderId?: string | null;
  collectionId?: string | null;
  title?: string;
  /** ISO updatedAt of the open song/service when known. */
  updatedAt?: string;
  artist?: string;
  contentExcerpt?: string;
  contentTruncated?: boolean;
  selectedSongIds?: string[];
  selectedFolderIds?: string[];
  /** Compact service element summary (ids/types/titles/songIds). */
  serviceElementsSummary?: Array<{
    id: string;
    type: string;
    title?: string;
    songId?: string;
  }>;
};

export type AiUiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; [key: string]: unknown }>;
};

export type UpdateAiSettingsInput = {
  provider?: AiProvider;
  model?: string;
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string | null;
};

export type AiConfirmAction = {
  action:
    | "delete_song"
    | "delete_service"
    | "delete_folder"
    | "delete_collection"
    | "delete_agenda";
  id: string;
  folderAction?: "move_to_root" | "delete_songs";
};

export const aiApi = {
  getSettings: (): Promise<AiSettingsPublic> =>
    getApiClient().request<AiSettingsPublic>("/ai/settings"),

  updateSettings: (input: UpdateAiSettingsInput): Promise<AiSettingsPublic> =>
    getApiClient().request<AiSettingsPublic>("/ai/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  clearKey: (): Promise<AiSettingsPublic> =>
    getApiClient().request<AiSettingsPublic>("/ai/settings/key", {
      method: "DELETE",
    }),

  confirmAction: (body: AiConfirmAction): Promise<{ confirmed: boolean }> =>
    getApiClient().request<{ confirmed: boolean }>("/ai/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  streamChat: (body: {
    messages: AiUiMessage[];
    context?: AiChatContext;
    /** UI language so replies match ("pt" | "en" | "es"). */
    locale?: string;
    signal?: AbortSignal;
  }): Promise<Response> =>
    getApiClient().request_raw("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: body.messages,
        context: body.context,
        locale: body.locale,
      }),
      signal: body.signal,
    }),
};
