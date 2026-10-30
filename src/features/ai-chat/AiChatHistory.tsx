/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { History, MessageSquare, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { AiThreadSummary } from "./types";

type Props = {
  threads: AiThreadSummary[];
  activeId: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

function relativeTime(ts: number, locale: string): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return rtf.format(0, "second");
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(ts).toLocaleDateString(locale);
}

/** Header popover listing saved conversations. */
export const AiChatHistory: React.FC<Props> = ({
  threads,
  activeId,
  onOpen,
  onDelete,
}) => {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t("ai.chat.history")}
        aria-label={t("ai.chat.history")}
        className={`p-1.5 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text ${
          open ? "bg-m3-hover text-m3-text" : ""
        }`}
      >
        <History className="w-4 h-4" />
      </button>
      {open && (
        <div className="logos-msg-in absolute right-0 top-full mt-1.5 w-[min(300px,80vw)] max-h-80 overflow-auto rounded-[var(--radius-lg)] border border-m3-border bg-m3-card shadow-xl p-1 z-20">
          {threads.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-[12px] text-m3-secondary">
              {t("ai.chat.historyEmpty")}
            </p>
          ) : (
            <ul role="listbox" className="list-none m-0 p-0">
              {threads.map((th) => (
                <li
                  key={th.id}
                  className={`group/th flex items-center rounded-[var(--radius-md)] ${
                    th.id === activeId
                      ? "bg-m3-primary/10"
                      : "hover:bg-m3-hover"
                  }`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={th.id === activeId}
                    onClick={() => {
                      onOpen(th.id);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 flex items-start gap-2 px-2 py-1.5 text-left"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-m3-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-m3-text truncate">
                        {th.title || t("ai.chat.historyUntitled")}
                      </span>
                      <span className="block text-[10.5px] text-m3-secondary">
                        {relativeTime(th.updatedAt, locale)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(th.id)}
                    title={t("ai.chat.historyDelete")}
                    aria-label={t("ai.chat.historyDelete")}
                    className="mr-1 p-1.5 rounded-[var(--radius-sm)] text-m3-secondary opacity-0 group-hover/th:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
