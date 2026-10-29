/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Sparkles, X } from "lucide-react";
import React from "react";
import { useAiChat } from "./AiChatProvider";

export const AiChatFab: React.FC = () => {
  const { t } = useI18n();
  const { visible, open, toggle } = useAiChat();

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? t("ai.chat.close") : t("ai.chat.open")}
      className="fixed bottom-20 right-4 z-[60] sm:bottom-6 sm:right-6 flex items-center justify-center w-12 h-12 rounded-full bg-m3-primary text-white shadow-[var(--shadow-lg)] hover:opacity-95 active:scale-95 transition-all"
    >
      {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
    </button>
  );
};
