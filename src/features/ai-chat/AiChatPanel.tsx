/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Markdown } from "@tanstack/markdown/react";
import {
  Eraser,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAiChat } from "./AiChatProvider";
import { AiToolCard } from "./AiToolCard";

export const AiChatPanel: React.FC = () => {
  const { t } = useI18n();
  const {
    open,
    setOpen,
    visible,
    messages,
    streaming,
    error,
    chips,
    send,
    stop,
    clear,
  } = useAiChat();

  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, streaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!visible || !open) return null;

  const onSubmit = async () => {
    const text = draft;
    setDraft("");
    await send(text);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-[55] w-full max-w-[420px] flex flex-col bg-m3-card border-l border-m3-border shadow-[var(--shadow-xl)] animate-in slide-in-from-right"
      aria-label={t("ai.chat.title")}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-m3-border shrink-0">
        <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-m3-text truncate">
            {t("ai.chat.title")}
          </h2>
          <p className="text-[11px] text-m3-secondary truncate">
            {t("ai.chat.subtitle")}
          </p>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-sidebar hover:text-m3-text"
          onClick={clear}
          title={t("ai.chat.clear")}
          aria-label={t("ai.chat.clear")}
        >
          <Eraser className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-sidebar hover:text-m3-text"
          onClick={() => setOpen(false)}
          aria-label={t("ai.chat.close")}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {chips.length > 0 && (
        <div className="px-3 py-2 border-b border-m3-border flex flex-wrap gap-1.5 shrink-0">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={streaming}
              className="text-[11px] px-2.5 py-1 rounded-[var(--radius-md)] border border-m3-border text-m3-text hover:bg-m3-sidebar disabled:opacity-50 transition-colors"
              onClick={() => void send(chip.prompt)}
            >
              {t(chip.labelKey)}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-m3-secondary text-center py-10 px-4">
            {t("ai.chat.empty")}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[92%] rounded-[var(--radius-lg)] px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-m3-primary text-white"
                  : "bg-m3-sidebar text-m3-text border border-m3-border"
              }`}
            >
              {msg.role === "assistant" ? (
                msg.text ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:text-[11px] [&_code]:text-[11px]">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                ) : streaming ? (
                  <span className="text-m3-secondary text-xs">
                    {t("ai.chat.thinking")}
                  </span>
                ) : null
              ) : (
                <span className="whitespace-pre-wrap">{msg.text}</span>
              )}
              {msg.error && (
                <p className="mt-1 text-xs text-red-500">{msg.error}</p>
              )}
            </div>
            {msg.tools.length > 0 && (
              <div className="w-[92%] space-y-1.5">
                {msg.tools.map((tool) => (
                  <AiToolCard key={tool.toolCallId} tool={tool} />
                ))}
              </div>
            )}
          </div>
        ))}
        {error && messages.every((m) => !m.error) && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>

      <footer className="border-t border-m3-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit();
              }
            }}
            placeholder={t("ai.chat.placeholder")}
            className="flex-1 resize-none rounded-[var(--radius-md)] border border-m3-border bg-m3-bg text-m3-text text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary"
            disabled={streaming}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="shrink-0 w-10 h-10 rounded-[var(--radius-md)] bg-m3-sidebar border border-m3-border text-m3-text flex items-center justify-center hover:bg-m3-border/40"
              aria-label={t("ai.chat.stop")}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!draft.trim()}
              className="shrink-0 w-10 h-10 rounded-[var(--radius-md)] bg-m3-primary text-white flex items-center justify-center disabled:opacity-40 hover:opacity-95"
              aria-label={t("ai.chat.send")}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
};
