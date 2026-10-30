/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Sparkles } from "lucide-react";
import React from "react";
import { useAiChatOptional } from "./AiChatProvider";
import { useAiProposals } from "./proposalStore";

/** Address-bar AI toggle (replaces the floating FAB). */
export const AiChatToggle: React.FC = () => {
  const { t, tc } = useI18n();
  const chat = useAiChatOptional();
  const pending = useAiProposals().length;
  if (!chat?.visible) return null;

  return (
    <button
      type="button"
      onClick={chat.toggle}
      title={`${chat.open ? t("ai.chat.close") : t("ai.chat.open")} (Ctrl+Shift+L)`}
      aria-label={chat.open ? t("ai.chat.close") : t("ai.chat.open")}
      aria-pressed={chat.open}
      className={`relative shrink-0 w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center border transition-colors ${
        chat.open
          ? "bg-m3-primary text-white border-m3-primary"
          : "bg-m3-card text-m3-text border-m3-border hover:bg-m3-sidebar"
      }`}
    >
      <Sparkles className="w-4 h-4" />
      {pending > 0 ? (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-m3-primary text-white text-[10px] font-bold leading-4 text-center ring-2 ring-m3-card"
          aria-label={tc("ai.chat.proposals.pending", pending)}
        >
          {pending}
        </span>
      ) : chat.streaming && !chat.open ? (
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-m3-primary animate-pulse ring-2 ring-m3-card"
          aria-hidden
        />
      ) : null}
    </button>
  );
};
