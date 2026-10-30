/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiSettingsPublic } from "@/src/api/ai";
import { useAuth } from "@/src/contexts/AuthContext";
import type { ServiceElement } from "@/src/types";
import { deriveView } from "@/src/layouts/view";
import { useI18n } from "@/src/lib/i18n";
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
} from "./contextBridge";
import { applyStreamEvent, settleRunningTools } from "./messageState";
import { extractServiceProposal, extractSongProposal } from "./proposals";
import { aiProposals } from "./proposalStore";
import { chipsForContext } from "./quickActions";
import { maybeDispatchStudioActions } from "./studioActions";
import { shouldStudioSyncAfterTool } from "./studioSync";
import { readUiMessageStream, type StreamEvent } from "./stream";
import { deriveThreadTitle, threadStore } from "./threadStore";
import {
  newId,
  toUiMessages,
  type AiChatMessage,
  type AiThread,
  type AiThreadSummary,
  type LogosMood,
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
  mood: LogosMood;
  includeContext: boolean;
  setIncludeContext: (v: boolean) => void;
  threads: AiThreadSummary[];
  threadId: string;
  send: (text: string) => Promise<void>;
  stop: () => void;
  /** Delete the current conversation and start fresh. */
  clear: () => void;
  newChat: () => void;
  openThread: (id: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  /** Re-run the last assistant reply. */
  regenerate: () => Promise<void>;
  /** Replace a user message with new text and re-run from there. */
  editAndResend: (messageId: string, text: string) => Promise<void>;
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
  /** `false` skips heavy editor content (used for the live header/chips). */
  withContent = true,
): PageContextSnapshot {
  const view = deriveView(pathname, slugPrefix);
  const songBridge = aiContextBridge.getSong();
  const serviceBridge = aiContextBridge.getService();
  const explorer = aiContextBridge.getExplorer();

  if (view === "song-editor") {
    const full = withContent ? (songBridge?.content ?? "") : "";
    const truncated = full.length > EXCERPT_MAX;
    return {
      kind: "song_editor",
      route: pathname,
      songId: params.id ?? songBridge?.songId,
      title: songBridge?.title,
      artist: songBridge?.artist,
      updatedAt: songBridge?.updatedAt,
      folderId: songBridge?.folderId ?? explorer?.folderId ?? null,
      contentExcerpt: truncated
        ? full.slice(0, EXCERPT_MAX)
        : full || undefined,
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
    const excerpt =
      withContent && serviceBridge
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
      contentExcerpt: truncated ? excerpt!.slice(0, EXCERPT_MAX) : excerpt,
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

function maybeStageProposal(
  toolName: string,
  output: unknown,
  page: PageContextSnapshot,
) {
  const song = extractSongProposal(output);
  if (song) {
    const songId = song.id ?? page.songId;
    if (songId) {
      aiProposals.stageSong({
        songId,
        content: song.content,
        title: song.title ?? page.title,
        artist: song.artist,
        source: toolName,
      });
    }
    return;
  }
  const service = extractServiceProposal(output);
  if (service) {
    const serviceId = service.serviceId ?? page.serviceId;
    if (serviceId) {
      aiProposals.stageService({
        serviceId,
        name: service.name,
        notes: service.notes,
        elements: service.elements as ServiceElement[],
        source: toolName,
      });
    }
  }
}

function maybeSyncLibrary(toolName: string, output: unknown) {
  if (!shouldStudioSyncAfterTool(toolName, output)) return;
  dispatchLibraryChanged({ action: toolName });
}

/** Stable fingerprint of the cheap page context (no editor content). */
function contextKey(ctx: PageContextSnapshot): string {
  return JSON.stringify([
    ctx.kind,
    ctx.route,
    ctx.songId,
    ctx.serviceId,
    ctx.folderId,
    ctx.collectionId,
    ctx.title,
    ctx.artist,
    ctx.selectedSongIds?.length ?? 0,
    ctx.selectedFolderIds?.length ?? 0,
  ]);
}

const RESTORE_WINDOW_MS = 6 * 60 * 60 * 1000;

export const AiChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { organization, user } = useAuth();
  const { language } = useI18n();
  const { granted: canUse } = useCan("ai.use");
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";
  const scope =
    organization?.id && user?.id ? `${organization.id}:${user.id}` : null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiSettingsPublic | null>(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [mood, setMood] = useState<LogosMood>("idle");
  const [threads, setThreads] = useState<AiThreadSummary[]>([]);
  const [threadId, setThreadId] = useState<string>(() => newId());
  const [threadCreatedAt, setThreadCreatedAt] = useState(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AiChatMessage[]>([]);
  const streamingRef = useRef(false);
  const restoredScopeRef = useRef<string | null>(null);
  const routeRef = useRef({ pathname: location.pathname, slugPrefix, params });
  routeRef.current = { pathname: location.pathname, slugPrefix, params };
  const localeRef = useRef(language);
  localeRef.current = language;
  const includeContextRef = useRef(includeContext);
  includeContextRef.current = includeContext;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ----------------------------- settings ----------------------------- */

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
    return () =>
      window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, onChanged);
  }, [refreshSettings]);

  /* --------------------------- page context --------------------------- */

  const [pageContext, setPageContext] = useState<PageContextSnapshot>(() =>
    buildPageContext(location.pathname, slugPrefix, params, false),
  );

  const recomputeContext = useCallback(() => {
    const r = routeRef.current;
    const next = buildPageContext(r.pathname, r.slugPrefix, r.params, false);
    setPageContext((prev) =>
      contextKey(prev) === contextKey(next) ? prev : next,
    );
  }, []);

  useEffect(() => {
    recomputeContext();
  }, [location.pathname, slugPrefix, params.id, recomputeContext]);

  // Event-driven (no polling): editors/explorer push changes into the bridge.
  useEffect(() => {
    if (!open) return;
    let timer = 0;
    const unsub = aiContextBridge.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(recomputeContext, 250);
    });
    recomputeContext();
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [open, recomputeContext]);

  const chips = useMemo(() => chipsForContext(pageContext), [pageContext]);
  const visible = Boolean(canUse && settings?.configured && settings?.enabled);

  /* ------------------------------ history ------------------------------ */

  const refreshThreads = useCallback(async () => {
    if (!scope) {
      setThreads([]);
      return;
    }
    setThreads(await threadStore.list(scope));
  }, [scope]);

  // Restore the most recent conversation (if recent) once per scope.
  useEffect(() => {
    if (!scope || restoredScopeRef.current === scope) return;
    restoredScopeRef.current = scope;
    let cancelled = false;
    void (async () => {
      const list = await threadStore.list(scope);
      if (cancelled) return;
      setThreads(list);
      const latest = list[0];
      if (!latest || Date.now() - latest.updatedAt > RESTORE_WINDOW_MS) return;
      const thread = await threadStore.load(scope, latest.id);
      if (cancelled || !thread || streamingRef.current) return;
      if (messagesRef.current.length > 0) return;
      setThreadId(thread.id);
      setThreadCreatedAt(thread.createdAt);
      setMessages(thread.messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // Persist after each completed turn (never mid-stream).
  useEffect(() => {
    if (!scope || streaming || messages.length === 0) return;
    const handle = window.setTimeout(() => {
      const thread: AiThread = {
        id: threadId,
        title: "",
        createdAt: threadCreatedAt,
        updatedAt: Date.now(),
        messages,
      };
      thread.title = deriveThreadTitle(thread);
      void threadStore.save(scope, thread).then(refreshThreads);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [messages, streaming, scope, threadId, threadCreatedAt, refreshThreads]);

  /* ------------------------------- mood -------------------------------- */

  const hadStreamRef = useRef(false);
  useEffect(() => {
    if (streaming) {
      hadStreamRef.current = true;
      const last = messages[messages.length - 1];
      const working = last?.parts.some(
        (p) => p.type === "tool" && p.tool.status === "running",
      );
      const singing = last?.parts.some(
        (p) => p.type === "text" && p.text.trim().length > 0,
      );
      // Tools running → headphones-on busy; words arriving → singing;
      // otherwise pondering.
      setMood(working ? "working" : singing ? "singing" : "thinking");
      return;
    }
    if (!hadStreamRef.current) return;
    hadStreamRef.current = false;
    const last = messages[messages.length - 1];
    const failed = Boolean(last?.error);
    const stopped = Boolean(last?.aborted);
    if (stopped) {
      setMood("idle");
      return;
    }
    const usedTools = last?.parts.some(
      (p) => p.type === "tool" && p.tool.status === "done",
    );
    setMood(failed ? "oops" : usedTools ? "celebrating" : "happy");
    const timer = window.setTimeout(
      () => setMood("idle"),
      failed ? 4000 : 2800,
    );
    return () => window.clearTimeout(timer);
  }, [streaming, messages]);

  /* ------------------------------ actions ------------------------------ */

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setStreaming(false);
    setMessages([]);
    messagesRef.current = [];
    setError(null);
    setThreadId(newId());
    setThreadCreatedAt(Date.now());
    setMood("idle");
  }, []);

  const newChat = useCallback(() => resetConversation(), [resetConversation]);

  const deleteThread = useCallback(
    async (id: string) => {
      if (!scope) return;
      await threadStore.remove(scope, id);
      if (id === threadId) resetConversation();
      await refreshThreads();
    },
    [scope, threadId, resetConversation, refreshThreads],
  );

  const clear = useCallback(() => {
    const id = threadId;
    resetConversation();
    if (scope) void threadStore.remove(scope, id).then(refreshThreads);
  }, [threadId, scope, resetConversation, refreshThreads]);

  const openThread = useCallback(
    async (id: string) => {
      if (!scope) return;
      const thread = await threadStore.load(scope, id);
      if (!thread) return;
      abortRef.current?.abort();
      setThreadId(thread.id);
      setThreadCreatedAt(thread.createdAt);
      setMessages(thread.messages);
      setError(null);
      setMood("idle");
    },
    [scope],
  );

  /** Core: stream an assistant reply for `history` (ends with a user turn). */
  const run = useCallback(async (history: AiChatMessage[]) => {
    if (streamingRef.current) return;
    streamingRef.current = true;

    const assistantId = newId();
    const startedAt = Date.now();
    const assistantMsg: AiChatMessage = {
      id: assistantId,
      role: "assistant",
      parts: [],
      createdAt: startedAt,
    };
    setError(null);
    setOpen(true);
    setMessages([...history, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const toolNames = new Map<string, string>();

    const patch = (fn: (m: AiChatMessage) => AiChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? fn(m) : m)),
      );
    };

    // Batch text/reasoning deltas to one render per frame.
    let pending: {
      type: "text-delta" | "reasoning-delta";
      delta: string;
    } | null = null;
    let scheduled = 0;
    const flush = () => {
      if (scheduled) {
        if (typeof cancelAnimationFrame === "function")
          cancelAnimationFrame(scheduled);
        window.clearTimeout(scheduled);
        scheduled = 0;
      }
      if (!pending) return;
      const ev = pending as StreamEvent;
      pending = null;
      patch((m) => applyStreamEvent(m, ev));
    };
    const schedule = () => {
      if (scheduled) return;
      if (document.visibilityState === "hidden") {
        scheduled = window.setTimeout(flush, 50);
      } else {
        scheduled = requestAnimationFrame(flush);
      }
    };

    try {
      const r = routeRef.current;
      const response = await aiApi.streamChat({
        messages: toUiMessages(history),
        context: includeContextRef.current
          ? buildPageContext(r.pathname, r.slugPrefix, r.params)
          : { kind: "general", route: r.pathname },
        locale: localeRef.current,
        signal: controller.signal,
      });

      for await (const event of readUiMessageStream(response)) {
        if (controller.signal.aborted) break;

        if (
          (event.type === "text-delta" || event.type === "reasoning-delta") &&
          typeof event.delta === "string"
        ) {
          if (pending && pending.type !== event.type) flush();
          pending = {
            type: event.type,
            delta: (pending?.delta ?? "") + event.delta,
          };
          schedule();
          continue;
        }

        flush();
        patch((m) => applyStreamEvent(m, event));

        if (
          event.type === "tool-input-start" ||
          event.type === "tool-input-available"
        ) {
          if (typeof event.toolName === "string") {
            toolNames.set(String(event.toolCallId), event.toolName);
          }
        } else if (event.type === "tool-output-available") {
          const name = toolNames.get(String(event.toolCallId)) ?? "tool";
          const rr = routeRef.current;
          maybeStageProposal(
            name,
            event.output,
            buildPageContext(rr.pathname, rr.slugPrefix, rr.params),
          );
          maybeSyncLibrary(name, event.output);
          maybeDispatchStudioActions(name, event.output);
        } else if (event.type === "error") {
          setError(
            typeof event.errorText === "string"
              ? event.errorText
              : "AI stream error",
          );
        }
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const message =
          err instanceof Error ? err.message : "Failed to reach AI chat";
        setError(message);
        patch((m) => ({ ...m, error: message }));
      }
    } finally {
      flush();
      const aborted = controller.signal.aborted;
      patch((m) => {
        const settled = settleRunningTools(
          m,
          aborted ? "stopped" : "interrupted",
        );
        return {
          ...settled,
          aborted: settled.aborted || aborted || undefined,
          meta: {
            ...settled.meta,
            durationMs: settled.meta?.durationMs ?? Date.now() - startedAt,
          },
        };
      });
      if (abortRef.current === controller) abortRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      const userMsg: AiChatMessage = {
        id: newId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
        createdAt: Date.now(),
      };
      await run([...messagesRef.current, userMsg]);
    },
    [run],
  );

  const regenerate = useCallback(async () => {
    if (streamingRef.current) return;
    const current = messagesRef.current;
    let end = current.length;
    while (end > 0 && current[end - 1].role === "assistant") end--;
    if (end === 0) return;
    await run(current.slice(0, end));
  }, [run]);

  const editAndResend = useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      const current = messagesRef.current;
      const idx = current.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const edited: AiChatMessage = {
        ...current[idx],
        parts: [{ type: "text", text: trimmed }],
      };
      await run([...current.slice(0, idx), edited]);
    },
    [run],
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Ctrl/Cmd + Shift + L toggles the chat.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "l"
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const value = useMemo<AiChatContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      messages,
      streaming,
      error,
      settings,
      canUse,
      visible,
      chips,
      pageContext,
      mood,
      includeContext,
      setIncludeContext,
      threads,
      threadId,
      send,
      stop,
      clear,
      newChat,
      openThread,
      deleteThread,
      regenerate,
      editAndResend,
      refreshSettings,
    }),
    [
      open,
      toggle,
      messages,
      streaming,
      error,
      settings,
      canUse,
      visible,
      chips,
      pageContext,
      mood,
      includeContext,
      threads,
      threadId,
      send,
      stop,
      clear,
      newChat,
      openThread,
      deleteThread,
      regenerate,
      editAndResend,
      refreshSettings,
    ],
  );

  return <AiChatCtx.Provider value={value}>{children}</AiChatCtx.Provider>;
};
