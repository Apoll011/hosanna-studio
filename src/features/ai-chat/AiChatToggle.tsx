/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Sparkles } from "lucide-react";
import React from "react";
import { useAiChatOptional } from "./AiChatProvider";

/** Address-bar AI toggle (replaces the floating FAB). */
export const AiChatToggle: React.FC = () => {
  const { t } = useI18n();
  const chat = useAiChatOptional();
  if (!chat?.visible) return null;

  return (
    <button
      type="button"
      onClick={chat.toggle}
      title={chat.open ? t("ai.chat.close") : t("ai.chat.open")}
      aria-label={chat.open ? t("ai.chat.close") : t("ai.chat.open")}
      aria-pressed={chat.open}
      className={`shrink-0 w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center border transition-colors ${
        chat.open
          ? "bg-m3-primary text-white border-m3-primary"
          : "bg-m3-card text-m3-text border-m3-border hover:bg-m3-sidebar"
      }`}
    >
      <Sparkles className="w-4 h-4" />
    </button>
  );
};
