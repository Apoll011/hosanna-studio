/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { ArrowUp, Eye, EyeOff, Square } from "lucide-react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { allChips } from "./quickActions";
import type { PageContextSnapshot } from "./types";

export type AiChatComposerHandle = { focus: () => void };

type Props = {
  streaming: boolean;
  pageContext: PageContextSnapshot;
  includeContext: boolean;
  onToggleContext: (v: boolean) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Scope for draft persistence (conversation id). */
  draftKey: string;
};

const MAX_ROWS_PX = 168;

/** Auto-growing composer with `/` quick actions; stays usable while streaming. */
export const AiChatComposer = forwardRef<AiChatComposerHandle, Props>(
  function AiChatComposer(
    {
      streaming,
      pageContext,
      includeContext,
      onToggleContext,
      onSend,
      onStop,
      draftKey,
    },
    ref,
  ) {
    const { t } = useI18n();
    const [draft, setDraft] = useState("");
    const [slashIndex, setSlashIndex] = useState(0);
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const storageKey = `hosanna:ai-draft:${draftKey}`;

    useImperativeHandle(ref, () => ({
      focus: () => areaRef.current?.focus(),
    }));

    // Restore the unsent draft for this conversation.
    useEffect(() => {
      try {
        setDraft(sessionStorage.getItem(storageKey) ?? "");
      } catch {
        setDraft("");
      }
    }, [storageKey]);

    useEffect(() => {
      try {
        if (draft) sessionStorage.setItem(storageKey, draft);
        else sessionStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable */
      }
    }, [draft, storageKey]);

    // Auto-grow.
    useEffect(() => {
      const el = areaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
    }, [draft]);

    const slashQuery = /^\/[^\s]*$/.test(draft)
      ? draft.slice(1).toLowerCase()
      : null;

    const slashItems = useMemo(() => {
      if (slashQuery === null) return [];
      return allChips(pageContext).filter((c) =>
        t(c.labelKey).toLowerCase().includes(slashQuery),
      );
    }, [slashQuery, pageContext, t]);

    useEffect(() => setSlashIndex(0), [slashQuery]);

    const submit = useCallback(
      (text: string) => {
        const value = text.trim();
        if (!value || streaming) return;
        setDraft("");
        onSend(value);
      },
      [streaming, onSend],
    );

    const pickSlash = (index: number) => {
      const chip = slashItems[index];
      if (!chip) return;
      setDraft("");
      onSend(t(chip.promptKey));
    };

    const slashOpen = slashQuery !== null;

    return (
      <div className="relative">
        {slashOpen && (
          <div
            role="listbox"
            aria-label={t("ai.chat.quickActions")}
            className="absolute bottom-full left-0 right-0 mb-1.5 max-h-56 overflow-auto rounded-[var(--radius-lg)] border border-m3-border bg-m3-card shadow-lg p-1 z-10"
          >
            {slashItems.length === 0 ? (
              <p className="m-0 px-2.5 py-2 text-[12px] text-m3-secondary">
                {t("ai.chat.slashEmpty")}
              </p>
            ) : (
              slashItems.map((chip, i) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    role="option"
                    aria-selected={i === slashIndex}
                    onMouseEnter={() => setSlashIndex(i)}
                    onClick={() => pickSlash(i)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-md)] text-left ${
                      i === slashIndex ? "bg-m3-primary/10" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-m3-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-m3-text truncate">
                        {t(chip.labelKey)}
                      </span>
                      <span className="block text-[11px] text-m3-secondary truncate">
                        {t(chip.descKey)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-[var(--radius-lg)] border border-m3-border bg-m3-bg px-2.5 py-2 focus-within:border-m3-primary focus-within:ring-2 focus-within:ring-m3-primary/20 transition-shadow">
          <textarea
            ref={areaRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (slashOpen && slashItems.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => (i + 1) % slashItems.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex(
                    (i) => (i - 1 + slashItems.length) % slashItems.length,
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pickSlash(slashIndex);
                  return;
                }
              }
              if (e.key === "Escape") {
                if (slashOpen) {
                  e.preventDefault();
                  setDraft("");
                } else if (streaming) {
                  e.preventDefault();
                  onStop();
                }
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder={t("ai.chat.placeholder")}
            aria-label={t("ai.chat.placeholder")}
            // The wrapper draws the focus ring; the global textarea:focus-visible
            // outline would otherwise add a second, mis-sized box.
            style={{ outline: "none", boxShadow: "none" }}
            className="flex-1 min-w-0 block min-h-8 m-0 py-1.5 px-0 border-0 resize-none bg-transparent text-m3-text text-[13px] leading-5 placeholder:text-m3-secondary/70"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="shrink-0 w-8 h-8 rounded-full bg-m3-text text-m3-bg flex items-center justify-center hover:opacity-85 transition-opacity"
              aria-label={t("ai.chat.stop")}
              title={`${t("ai.chat.stop")} (Esc)`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={!draft.trim()}
              className="shrink-0 w-8 h-8 rounded-full bg-m3-primary text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 transition-opacity"
              aria-label={t("ai.chat.send")}
              title={t("ai.chat.send")}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5 text-[10.5px] text-m3-secondary">
          <button
            type="button"
            onClick={() => onToggleContext(!includeContext)}
            aria-pressed={includeContext}
            title={t("ai.chat.contextHint")}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-m3-hover ${
              includeContext ? "text-m3-primary" : ""
            }`}
          >
            {includeContext ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            {t("ai.chat.includeContext")}
          </button>
          <span className="truncate hidden sm:inline">
            {t("ai.chat.composerHint")}
          </span>
        </div>
      </div>
    );
  },
);
