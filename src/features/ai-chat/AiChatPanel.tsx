/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import {
  ArrowDown,
  Maximize2,
  Minimize2,
  MessageSquarePlus,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiChatComposer, type AiChatComposerHandle } from "./AiChatComposer";
import { AiChatEmpty } from "./AiChatEmpty";
import { AiChatHistory } from "./AiChatHistory";
import { AiProposalTray } from "./AiProposalTray";
import { AiChatMessageView } from "./AiChatMessage";
import { useAiChat } from "./AiChatProvider";
import { LogosMascot } from "./LogosMascot";
import type { PageContextSnapshot } from "./types";

const STICK_THRESHOLD_PX = 72;

function useContextLabel(ctx: PageContextSnapshot): string {
  const { t } = useI18n();
  const title = ctx.title?.trim();
  switch (ctx.kind) {
    case "song_editor":
      return title
        ? t("ai.chat.contextSong", { title })
        : t("ai.chat.contextSongs");
    case "service_editor":
      return title
        ? t("ai.chat.contextService", { title })
        : t("ai.chat.contextServices");
    case "songs_list":
      return t("ai.chat.contextSongs");
    case "services_list":
      return t("ai.chat.contextServices");
    case "explorer":
      return t("ai.chat.contextExplorer");
    case "collection_detail":
      return t("ai.chat.contextCollection");
    case "agenda":
      return t("ai.chat.contextAgenda");
    case "trash":
      return t("ai.chat.contextTrash");
    default:
      return t("ai.chat.contextGeneral");
  }
}

type PanelProps = {
  /** Dock can offer a wide mode (desktop only). */
  wide?: boolean;
  onToggleWide?: () => void;
};

/** In-flow docked chat column — parent controls width; this fills height. */
export const AiChatPanel: React.FC<PanelProps> = ({ wide, onToggleWide }) => {
  const { t } = useI18n();
  const {
    open,
    setOpen,
    visible,
    messages,
    streaming,
    chips,
    pageContext,
    mood,
    includeContext,
    setIncludeContext,
    threads,
    threadId,
    send,
    stop,
    newChat,
    openThread,
    deleteThread,
    regenerate,
    editAndResend,
  } = useAiChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<AiChatComposerHandle>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const contextLabel = useContextLabel(pageContext);
  const empty = messages.length === 0;
  // Say out loud what the mascot's face is already showing.
  const moodStatus =
    mood === "thinking"
      ? t("ai.chat.status.thinking")
      : mood === "working"
        ? t("ai.chat.status.working")
        : mood === "singing"
          ? t("ai.chat.status.singing")
          : mood === "happy"
            ? t("ai.chat.status.happy")
            : mood === "celebrating"
              ? t("ai.chat.status.celebrating")
              : mood === "oops"
                ? t("ai.chat.status.oops")
                : null;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = atBottom;
    setShowJump((prev) => (prev === !atBottom ? prev : !atBottom));
  }, []);

  // Follow growth (streaming, expanding tool groups) only while pinned.
  useEffect(() => {
    const content = contentRef.current;
    if (!open || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [open, empty, scrollToBottom]);

  // A new user turn always re-pins.
  const lastUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);
  useEffect(() => {
    stickRef.current = true;
    scrollToBottom();
  }, [lastUserId, threadId, scrollToBottom]);

  useEffect(() => {
    if (open) composerRef.current?.focus();
  }, [open, threadId]);

  if (!visible) return null;

  const lastIndex = messages.length - 1;

  return (
    <aside
      className={`h-full w-full flex flex-col bg-m3-card overflow-hidden transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      // `inert` removes the hidden panel from tab order and the a11y tree.
      {...({ inert: !open } as Record<string, unknown>)}
      aria-label={t("ai.chat.title")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented && !streaming) {
          setOpen(false);
        }
      }}
    >
      <header className="flex items-center gap-2 pl-3 pr-2 py-2 border-b border-m3-border shrink-0">
        <LogosMascot flat interactive size={40} mood={mood} />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-m3-text truncate m-0 leading-tight">
            {t("ai.chat.title")}
          </h2>
          {moodStatus ? (
            <p
              key={mood}
              className="logos-msg-in m-0 text-[11px] font-medium text-m3-primary truncate leading-tight"
              role="status"
            >
              {moodStatus}
            </p>
          ) : (
            <p
              className="m-0 text-[11px] text-m3-secondary truncate leading-tight"
              title={t("ai.chat.contextHint")}
            >
              {includeContext ? contextLabel : t("ai.chat.subtitle")}
            </p>
          )}
        </div>
        <button
          type="button"
          className="p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          onClick={newChat}
          title={t("ai.chat.new")}
          aria-label={t("ai.chat.new")}
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
        <AiChatHistory
          threads={threads}
          activeId={threadId}
          onOpen={(id) => void openThread(id)}
          onDelete={(id) => void deleteThread(id)}
        />
        {onToggleWide && (
          <button
            type="button"
            className="hidden sm:inline-flex p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
            onClick={onToggleWide}
            title={wide ? t("ai.chat.collapse") : t("ai.chat.expand")}
            aria-label={wide ? t("ai.chat.collapse") : t("ai.chat.expand")}
          >
            {wide ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          type="button"
          className="p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          onClick={() => setOpen(false)}
          title={t("ai.chat.close")}
          aria-label={t("ai.chat.close")}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <AiProposalTray />

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain custom-scrollbar"
        >
          {empty ? (
            <AiChatEmpty
              chips={chips}
              mood={mood}
              disabled={streaming}
              onPick={(prompt) => void send(prompt)}
            />
          ) : (
            <div ref={contentRef} className="px-3 py-4 space-y-4">
              {messages.map((msg, i) => (
                <AiChatMessageView
                  key={msg.id}
                  msg={msg}
                  isLast={i === lastIndex}
                  streaming={streaming}
                  mood={i === lastIndex ? mood : "idle"}
                  onRegenerate={() => void regenerate()}
                  onEdit={(id, text) => void editAndResend(id, text)}
                  onSend={(text) => void send(text)}
                />
              ))}
            </div>
          )}
        </div>

        {showJump && !empty && (
          <button
            type="button"
            onClick={() => {
              stickRef.current = true;
              scrollToBottom(true);
            }}
            className="logos-msg-in absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-m3-border bg-m3-card shadow-md px-3 py-1 text-[11.5px] text-m3-text hover:bg-m3-hover"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {t("ai.chat.jumpToLatest")}
          </button>
        )}
      </div>

      <footer className="border-t border-m3-border px-2.5 pt-2 pb-2.5 shrink-0 space-y-2">
        {!empty && chips.length > 0 && (
          <div
            className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-0.5 px-0.5"
            role="group"
            aria-label={t("ai.chat.quickActions")}
          >
            {chips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={streaming}
                  title={t(chip.descKey)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-full border border-m3-border bg-m3-card text-m3-text hover:border-m3-primary/50 hover:bg-m3-primary/5 disabled:opacity-50 transition-colors"
                  onClick={() => void send(t(chip.promptKey))}
                >
                  <Icon className="w-3 h-3 text-m3-primary" />
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>
        )}
        <AiChatComposer
          ref={composerRef}
          streaming={streaming}
          pageContext={pageContext}
          includeContext={includeContext}
          onToggleContext={setIncludeContext}
          onSend={(text) => void send(text)}
          onStop={stop}
          draftKey={threadId}
        />
      </footer>
    </aside>
  );
};
