/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Check, Loader2, Wrench, X } from "lucide-react";
import React from "react";
import type { AiToolCallState } from "./types";

/** Compact inline tool status — proposals are staged in the editor, not here. */
export const AiToolCard: React.FC<{ tool: AiToolCallState }> = ({ tool }) => {
  const { t } = useI18n();

  const statusIcon =
    tool.status === "running" ? (
      <Loader2 className="w-3 h-3 animate-spin text-m3-primary" />
    ) : tool.status === "error" ? (
      <X className="w-3 h-3 text-red-500" />
    ) : (
      <Check className="w-3 h-3 text-emerald-500" />
    );

  const statusLabel =
    tool.status === "running"
      ? t("ai.chat.toolRunning")
      : tool.status === "error"
        ? t("ai.chat.toolError")
        : t("ai.chat.toolDone");

  return (
    <div className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-m3-border bg-m3-card/80 px-2 py-1 text-[11px] text-m3-secondary my-1">
      <Wrench className="w-3 h-3 shrink-0 opacity-70" />
      <span className="font-medium text-m3-text truncate max-w-[160px]">
        {tool.toolName}
      </span>
      {statusIcon}
      <span className="shrink-0">{statusLabel}</span>
    </div>
  );
};
