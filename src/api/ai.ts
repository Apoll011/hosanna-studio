/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

export type AiProvider =
  "openai" | "anthropic" | "google" | "deepseek" | "openai_compatible";

export type NativeWebCapability = {
  search: boolean;
  fetch: boolean;
  note: string;
};

export type AiLimits = {
  maxToolCalls: { min: number; max: number; default: number };
  temperature: { min: number; max: number };
  maxOutputTokens: { min: number; max: number };
  instructionsMaxChars: number;
  memoryMaxEntries: number;
  memoryEntryMaxChars: number;
};

export type AiMemoryItem = {
  id: string;
  content: string;
  source: "admin" | "ai" | string;
  createdAt: string;
};

export type AiSettingsPublic = {
  provider: AiProvider;
  model: string;
  enabled: boolean;
  configured: boolean;
  baseUrl: string | null;
  encryptionReady: boolean;
  /** Max tool calls the assistant may make per reply. */
  maxToolCalls: number;
  /** null = model default. */
  temperature: number | null;
  /** null = model default. */
  maxOutputTokens: number | null;
  instructions: string;
  memoryEnabled: boolean;
  limits: AiLimits;
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
  maxToolCalls?: number;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  instructions?: string | null;
  memoryEnabled?: boolean;
};

export type AiBalanceInfo = {
  currency: string;
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
};

export type AiBillingResponse =
  | {
      supported: true;
      provider: "deepseek";
      kind: "balance";
      isAvailable: boolean;
      balances: AiBalanceInfo[];
      fetchedAt: string;
    }
  | {
      supported: false;
      provider: AiProvider;
      reason: "unsupported_provider" | "not_configured" | "disabled_crypto";
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
  getSettings: async (): Promise<AiSettingsPublic> =>
    (await unwrapApiResult(
      await getApiClient().openapi.GET("/ai/settings"),
    )) as AiSettingsPublic,

  updateSettings: async (
    input: UpdateAiSettingsInput,
  ): Promise<AiSettingsPublic> =>
    (await unwrapApiResult(
      await getApiClient().openapi.PUT("/ai/settings", {
        body: input as { [key: string]: unknown },
      }),
    )) as AiSettingsPublic,

  clearKey: async (): Promise<AiSettingsPublic> =>
    (await unwrapApiResult(
      await getApiClient().openapi.DELETE("/ai/settings/key"),
    )) as AiSettingsPublic,

  getBilling: async (): Promise<AiBillingResponse> =>
    (await unwrapApiResult(
      await getApiClient().openapi.GET("/ai/billing"),
    )) as AiBillingResponse,

  listMemory: async (): Promise<{ items: AiMemoryItem[] }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/ai/memory"),
    );
    return { items: (data?.items ?? []) as AiMemoryItem[] };
  },

  addMemory: async (content: string): Promise<AiMemoryItem> =>
    (await unwrapApiResult(
      await getApiClient().openapi.POST("/ai/memory", {
        body: { content },
      }),
    )) as AiMemoryItem,

  removeMemory: async (id: string): Promise<void> => {
    await unwrapApiResult(
      await getApiClient().openapi.DELETE("/ai/memory/{id}", {
        params: { path: { id } },
      }),
    );
  },

  clearMemory: async (): Promise<{ cleared: number }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.DELETE("/ai/memory"),
    );
    return { cleared: data?.cleared ?? 0 };
  },

  confirmAction: async (
    body: AiConfirmAction,
  ): Promise<{ confirmed: boolean }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.POST("/ai/confirm", {
        body,
      }),
    );
    return {
      confirmed: Boolean((data as { confirmed?: boolean })?.confirmed),
    };
  },

  streamChat: async (body: {
    messages: AiUiMessage[];
    context?: AiChatContext;
    /** UI language so replies match ("pt" | "en" | "es"). */
    locale?: string;
    signal?: AbortSignal;
  }): Promise<Response> => {
    const { data, error, response } = await getApiClient().openapi.POST(
      "/ai/chat",
      {
        body: {
          messages: body.messages as { [key: string]: unknown }[],
          context: body.context as { [key: string]: unknown } | undefined,
          locale: body.locale as "pt" | "en" | "es" | undefined,
        },
        parseAs: "stream",
        signal: body.signal,
      },
    );

    if (!response.ok) {
      await unwrapApiResult({ data, error, response });
    }

    return response;
  },
};
