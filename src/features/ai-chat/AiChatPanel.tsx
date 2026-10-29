/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Markdown } from "@tanstack/markdown/react";
import { Eraser, Send, Sparkles, Square, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAiChat } from "./AiChatProvider";
import { AiToolCard } from "./AiToolCard";

/** In-flow docked chat column — parent controls width; this fills height. */
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

  if (!visible) return null;

  const onSubmit = async () => {
    const text = draft;
    setDraft("");
    await send(text);
  };

  return (
    <aside
      className={`h-full w-full flex flex-col bg-m3-card overflow-hidden transition-[opacity] duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
      aria-label={t("ai.chat.title")}
    >
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-m3-border shrink-0">
        <div className="w-7 h-7 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-m3-text truncate">
            {t("ai.chat.title")}
          </h2>
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
        <div className="px-2.5 py-2 border-b border-m3-border flex flex-wrap gap-1.5 shrink-0">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={streaming}
              className="text-[11px] px-2 py-0.5 rounded-[var(--radius-md)] border border-m3-border text-m3-text hover:bg-m3-sidebar disabled:opacity-50 transition-colors"
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
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] px-3 py-2 text-sm bg-m3-primary text-white whitespace-pre-wrap">
                {msg.parts
                  .filter((p) => p.type === "text")
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("")}
              </div>
            ) : (
              <div className="max-w-[95%] w-full space-y-1">
                {msg.parts.length === 0 && streaming ? (
                  <span className="text-m3-secondary text-xs px-1">
                    {t("ai.chat.thinking")}
                  </span>
                ) : null}
                {msg.parts.map((part, i) =>
                  part.type === "tool" ? (
                    <AiToolCard key={part.tool.toolCallId} tool={part.tool} />
                  ) : part.text.trim() ? (
                    <div
                      key={`t-${i}`}
                      className="rounded-[var(--radius-lg)] px-3 py-2 text-sm leading-relaxed bg-m3-sidebar text-m3-text border border-m3-border"
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:text-[11px] [&_code]:text-[11px] [&_pre]:max-h-40 [&_pre]:overflow-auto">
                        <Markdown>{part.text}</Markdown>
                      </div>
                    </div>
                  ) : null,
                )}
                {msg.error && (
                  <p className="text-xs text-red-500 px-1">{msg.error}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {error && messages.every((m) => !m.error) && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>

      <footer className="border-t border-m3-border p-2.5 shrink-0">
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
              className="shrink-0 w-9 h-9 rounded-[var(--radius-md)] bg-m3-sidebar border border-m3-border text-m3-text flex items-center justify-center"
              aria-label={t("ai.chat.stop")}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!draft.trim()}
              className="shrink-0 w-9 h-9 rounded-[var(--radius-md)] bg-m3-primary text-white flex items-center justify-center disabled:opacity-40"
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
