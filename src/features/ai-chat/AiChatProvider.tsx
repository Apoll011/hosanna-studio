/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiSettingsPublic } from "@/src/api/ai";
import { useAuth } from "@/src/contexts/AuthContext";
import { deriveView } from "@/src/layouts/view";
import { useCan } from "@/src/lib/permissions/client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  AI_SETTINGS_CHANGED_EVENT,
  aiContextBridge,
  dispatchLibraryChanged,
  dispatchStageService,
  dispatchStageSong,
} from "./contextBridge";
import { extractServiceProposal, extractSongProposal } from "./proposals";
import { chipsForContext } from "./quickActions";
import { maybeDispatchStudioActions } from "./studioActions";
import { shouldStudioSyncAfterTool } from "./studioSync";
import { readUiMessageStream } from "./stream";
import {
  newId,
  toUiMessages,
  type AiChatMessage,
  type AiMessagePart,
  type AiToolCallState,
  type PageContextSnapshot,
  type QuickChip,
} from "./types";

type AiChatContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  messages: AiChatMessage[];
  streaming: boolean;
  error: string | null;
  settings: AiSettingsPublic | null;
  canUse: boolean;
  visible: boolean;
  chips: QuickChip[];
  pageContext: PageContextSnapshot;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  refreshSettings: () => Promise<void>;
};

const AiChatCtx = createContext<AiChatContextValue | null>(null);

export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatCtx);
  if (!ctx) {
    throw new Error("useAiChat must be used within AiChatProvider");
  }
  return ctx;
}

/** Safe when provider may be absent (e.g. address bar outside mount). */
export function useAiChatOptional(): AiChatContextValue | null {
  return useContext(AiChatCtx);
}

const EXCERPT_MAX = 12_000;

function buildPageContext(
  pathname: string,
  slugPrefix: string,
  params: { id?: string },
): PageContextSnapshot {
  const view = deriveView(pathname, slugPrefix);
  const songBridge = aiContextBridge.getSong();
  const serviceBridge = aiContextBridge.getService();
  const explorer = aiContextBridge.getExplorer();

  if (view === "song-editor") {
    const full = songBridge?.content ?? "";
    const truncated = full.length > EXCERPT_MAX;
    return {
      kind: "song_editor",
      route: pathname,
      songId: params.id ?? songBridge?.songId,
      title: songBridge?.title,
      artist: songBridge?.artist,
      updatedAt: songBridge?.updatedAt,
      folderId: songBridge?.folderId ?? explorer?.folderId ?? null,
      contentExcerpt: truncated ? full.slice(0, EXCERPT_MAX) : full || undefined,
      contentTruncated: truncated || undefined,
    };
  }
  if (view === "service-editor") {
    const summary =
      serviceBridge?.elements.map((el) => ({
        id: el.id,
        type: el.type,
        title: el.title,
        songId: el.songId,
      })) ?? [];
    const excerpt = serviceBridge
      ? JSON.stringify(
          {
            name: serviceBridge.title,
            date: serviceBridge.date,
            notes: serviceBridge.notes,
            elements: summary,
          },
          null,
          2,
        )
      : undefined;
    const truncated = Boolean(excerpt && excerpt.length > EXCERPT_MAX);
    return {
      kind: "service_editor",
      route: pathname,
      serviceId: params.id ?? serviceBridge?.serviceId,
      title: serviceBridge?.title,
      updatedAt: serviceBridge?.updatedAt,
      contentExcerpt: truncated
        ? excerpt!.slice(0, EXCERPT_MAX)
        : excerpt,
      contentTruncated: truncated || undefined,
      serviceElementsSummary: summary,
    };
  }
  if (view === "songs") {
    return {
      kind: "songs_list",
      route: pathname,
      folderId: explorer?.folderId ?? null,
      selectedSongIds: explorer?.selectedSongIds,
      selectedFolderIds: explorer?.selectedFolderIds,
    };
  }
  if (view === "services") return { kind: "services_list", route: pathname };
  if (view === "collection-detail") {
    return {
      kind: "collection_detail",
      route: pathname,
      collectionId: explorer?.collectionId ?? params.id ?? null,
      selectedSongIds: explorer?.selectedSongIds,
    };
  }
  if (view === "agenda") return { kind: "agenda", route: pathname };
  if (view === "trash") return { kind: "trash", route: pathname };
  if (view === "explorer") {
    return {
      kind: "explorer",
      route: pathname,
      folderId: explorer?.folderId ?? null,
      selectedSongIds: explorer?.selectedSongIds,
      selectedFolderIds: explorer?.selectedFolderIds,
    };
  }
  return {
    kind: "general",
    route: pathname,
    folderId: explorer?.folderId ?? null,
    collectionId: explorer?.collectionId ?? null,
    selectedSongIds: explorer?.selectedSongIds,
    selectedFolderIds: explorer?.selectedFolderIds,
  };
}

function upsertToolPart(
  parts: AiMessagePart[],
  tool: AiToolCallState,
): AiMessagePart[] {
  const idx = parts.findIndex(
    (p) => p.type === "tool" && p.tool.toolCallId === tool.toolCallId,
  );
  if (idx >= 0) {
    const next = [...parts];
    next[idx] = { type: "tool", tool };
    return next;
  }
  return [...parts, { type: "tool", tool }];
}

function appendTextDelta(parts: AiMessagePart[], delta: string): AiMessagePart[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === "text") {
    next[next.length - 1] = { type: "text", text: last.text + delta };
    return next;
  }
  next.push({ type: "text", text: delta });
  return next;
}

function maybeStageProposal(
  toolName: string,
  output: unknown,
  page: PageContextSnapshot,
) {
  const song = extractSongProposal(output);
  if (song) {
    dispatchStageSong({
      songId: song.id ?? page.songId,
      content: song.content,
      title: song.title ?? page.title,
      artist: song.artist,
      diffPreview: song.diffPreview,
      source: toolName,
    });
    return;
  }
  const service = extractServiceProposal(output);
  if (service) {
    dispatchStageService({
      serviceId: service.serviceId ?? page.serviceId,
      name: service.name,
      notes: service.notes,
      elements: service.elements as never,
      source: toolName,
    });
  }
}

function maybeSyncLibrary(toolName: string, output: unknown) {
  if (!shouldStudioSyncAfterTool(toolName, output)) return;
  dispatchLibraryChanged({ action: toolName });
}

export const AiChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { organization } = useAuth();
  const { granted: canUse } = useCan("ai.use");
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiSettingsPublic | null>(null);
  const [contextTick, setContextTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!canUse || !organization) {
      setSettings(null);
      return;
    }
    try {
      setSettings(await aiApi.getSettings());
    } catch {
      setSettings(null);
    }
  }, [canUse, organization]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    const onChanged = () => void refreshSettings();
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, onChanged);
  }, [refreshSettings]);

  useEffect(() => {
    setContextTick((n) => n + 1);
  }, [location.pathname, params.id]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setContextTick((n) => n + 1), 1500);
    return () => window.clearInterval(id);
  }, [open]);

  const pageContext = useMemo(
    () => buildPageContext(location.pathname, slugPrefix, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, slugPrefix, params.id, contextTick],
  );

  const chips = useMemo(() => chipsForContext(pageContext), [pageContext]);
  const visible = Boolean(canUse && settings?.configured && settings?.enabled);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);
      setOpen(true);

      const userMsg: AiChatMessage = {
        id: newId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      };
      const assistantId = newId();
      const assistantMsg: AiChatMessage = {
        id: assistantId,
        role: "assistant",
        parts: [],
      };

      const nextMessages = [...messages, userMsg];
      setMessages([...nextMessages, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const toolsById = new Map<string, AiToolCallState>();

      const patchParts = (updater: (parts: AiMessagePart[]) => AiMessagePart[]) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, parts: updater(m.parts) } : m,
          ),
        );
      };

      try {
        const response = await aiApi.streamChat({
          messages: toUiMessages(nextMessages),
          context: buildPageContext(location.pathname, slugPrefix, params),
          signal: controller.signal,
        });

        for await (const event of readUiMessageStream(response)) {
          if (controller.signal.aborted) break;

          if (event.type === "text-delta" && typeof event.delta === "string") {
            const delta = event.delta;
            patchParts((parts) => appendTextDelta(parts, delta));
          } else if (event.type === "tool-input-start") {
            const tool: AiToolCallState = {
              toolCallId: String(event.toolCallId),
              toolName: String(event.toolName),
              status: "running",
            };
            toolsById.set(tool.toolCallId, tool);
            patchParts((parts) => upsertToolPart(parts, tool));
          } else if (event.type === "tool-input-available") {
            const id = String(event.toolCallId);
            const existing = toolsById.get(id) ?? {
              toolCallId: id,
              toolName: String(event.toolName ?? "tool"),
              status: "running" as const,
            };
            existing.input = event.input;
            existing.toolName = String(event.toolName ?? existing.toolName);
            toolsById.set(id, existing);
            patchParts((parts) => upsertToolPart(parts, existing));
          } else if (event.type === "tool-output-available") {
            const id = String(event.toolCallId);
            const existing = toolsById.get(id) ?? {
              toolCallId: id,
              toolName: "tool",
              status: "done" as const,
            };
            existing.output = event.output;
            existing.status = "done";
            toolsById.set(id, existing);
            patchParts((parts) => upsertToolPart(parts, existing));
            maybeStageProposal(
              existing.toolName,
              event.output,
              buildPageContext(location.pathname, slugPrefix, params),
            );
            maybeSyncLibrary(existing.toolName, event.output);
            maybeDispatchStudioActions(existing.toolName, event.output);
          } else if (event.type === "error") {
            const msg =
              typeof event.errorText === "string"
                ? event.errorText
                : "AI stream error";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, error: msg } : m,
              ),
            );
            setError(msg);
          }
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to reach AI chat";
        setError(message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, error: message } : m,
          ),
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, messages, location.pathname, slugPrefix, params],
  );

  const value = useMemo<AiChatContextValue>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((v) => !v),
      messages,
      streaming,
      error,
      settings,
      canUse,
      visible,
      chips,
      pageContext,
      send,
      stop,
      clear,
      refreshSettings,
    }),
    [
      open,
      messages,
      streaming,
      error,
      settings,
      canUse,
      visible,
      chips,
      pageContext,
      send,
      stop,
      clear,
      refreshSettings,
    ],
  );

  return <AiChatCtx.Provider value={value}>{children}</AiChatCtx.Provider>;
};
