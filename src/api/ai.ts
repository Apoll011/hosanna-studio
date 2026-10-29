/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiClient } from "./http";

export type AiProvider = "openai" | "anthropic" | "google";

export type AiSettingsPublic = {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  configured: boolean;
  encryptionReady: boolean;
  providers: AiProvider[];
  modelPresets: Record<AiProvider, string[]>;
};

export type AiChatContext = {
  kind?:
    | "song_editor"
    | "service_editor"
    | "songs_list"
    | "services_list"
    | "general";
  route?: string;
  songId?: string;
  serviceId?: string;
  title?: string;
  contentExcerpt?: string;
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

  streamChat: (body: {
    messages: AiUiMessage[];
    context?: AiChatContext;
    signal?: AbortSignal;
  }): Promise<Response> =>
    getApiClient().request_raw("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: body.messages,
        context: body.context,
      }),
      signal: body.signal,
    }),
};
