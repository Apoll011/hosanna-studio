/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiSettingsPublic } from "@/src/api/ai";
import { useAuth } from "@/src/contexts/AuthContext";
import { useCan } from "@/src/lib/permissions/client";
import { deriveView } from "@/src/layouts/view";
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
} from "./contextBridge";
import { chipsForContext } from "./quickActions";
import { readUiMessageStream } from "./stream";
import {
  newId,
  toUiMessages,
  type AiChatMessage,
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

function buildPageContext(
  pathname: string,
  slugPrefix: string,
  params: { id?: string },
): PageContextSnapshot {
  const view = deriveView(pathname, slugPrefix);
  const songBridge = aiContextBridge.getSong();
  const serviceBridge = aiContextBridge.getService();

  if (view === "song-editor") {
    return {
      kind: "song_editor",
      route: pathname,
      songId: params.id ?? songBridge?.songId,
      title: songBridge?.title,
      contentExcerpt: songBridge?.content?.slice(0, 12_000),
    };
  }
  if (view === "service-editor") {
    const excerpt = serviceBridge
      ? JSON.stringify(
          {
            name: serviceBridge.title,
            elements: serviceBridge.elements,
          },
          null,
          2,
        ).slice(0, 12_000)
      : undefined;
    return {
      kind: "service_editor",
      route: pathname,
      serviceId: params.id ?? serviceBridge?.serviceId,
      title: serviceBridge?.title,
      contentExcerpt: excerpt,
    };
  }
  if (view === "songs") {
    return { kind: "songs_list", route: pathname };
  }
  if (view === "services") {
    return { kind: "services_list", route: pathname };
  }
  return { kind: "general", route: pathname };
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
      const data = await aiApi.getSettings();
      setSettings(data);
    } catch {
      setSettings(null);
    }
  }, [canUse, organization]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    const onChanged = () => {
      void refreshSettings();
    };
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, onChanged);
  }, [refreshSettings]);

  // Re-read bridge when route changes or periodically while open
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
    // contextTick forces re-read of bridge content
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, slugPrefix, params.id, contextTick],
  );

  const chips = useMemo(() => chipsForContext(pageContext), [pageContext]);

  const visible = Boolean(
    canUse && settings?.configured && settings?.enabled,
  );

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
      const userMsg: AiChatMessage = {
        id: newId(),
        role: "user",
        text: trimmed,
        tools: [],
      };
      const assistantId = newId();
      const assistantMsg: AiChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        tools: [],
      };

      const nextMessages = [...messages, userMsg];
      setMessages([...nextMessages, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await aiApi.streamChat({
          messages: toUiMessages(nextMessages),
          context: buildPageContext(location.pathname, slugPrefix, params),
          signal: controller.signal,
        });

        const toolsById = new Map<string, AiToolCallState>();

        const patchAssistant = (patch: Partial<AiChatMessage>) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
          );
        };

        for await (const event of readUiMessageStream(response)) {
          if (controller.signal.aborted) break;

          if (event.type === "text-delta" && typeof event.delta === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, text: m.text + event.delta }
                  : m,
              ),
            );
          } else if (event.type === "tool-input-start") {
            const tool: AiToolCallState = {
              toolCallId: String(event.toolCallId),
              toolName: String(event.toolName),
              status: "running",
            };
            toolsById.set(tool.toolCallId, tool);
            patchAssistant({ tools: Array.from(toolsById.values()) });
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
            patchAssistant({ tools: Array.from(toolsById.values()) });
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
            patchAssistant({ tools: Array.from(toolsById.values()) });
          } else if (event.type === "error") {
            const msg =
              typeof event.errorText === "string"
                ? event.errorText
                : "AI stream error";
            patchAssistant({ error: msg });
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
