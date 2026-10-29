/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Check, ChevronDown, Loader2, Wrench, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { AiToolCallState } from "./types";

function formatToolPayload(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Expandable tool call chip shown inside the assistant message bubble. */
export const AiToolCard: React.FC<{ tool: AiToolCallState }> = ({ tool }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

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

  const inputText = useMemo(() => formatToolPayload(tool.input), [tool.input]);
  const outputText = useMemo(
    () => formatToolPayload(tool.output),
    [tool.output],
  );
  const hasDetails = Boolean(inputText || outputText);

  return (
    <div className="my-1.5 rounded-[var(--radius-md)] border border-m3-border/80 bg-m3-card/60 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-left hover:bg-m3-sidebar/60 transition-colors"
        onClick={() => hasDetails && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasDetails && tool.status === "running"}
      >
        <Wrench className="w-3 h-3 shrink-0 opacity-70" />
        <span className="font-medium text-m3-text truncate flex-1 min-w-0">
          {tool.toolName}
        </span>
        {statusIcon}
        <span className="shrink-0 text-m3-secondary">{statusLabel}</span>
        {hasDetails && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-m3-secondary transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {open && hasDetails && (
        <div className="border-t border-m3-border px-2 py-2 space-y-2 bg-m3-bg/40 max-h-56 overflow-auto">
          {inputText ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-m3-secondary mb-1">
                {t("ai.chat.toolInput")}
              </p>
              <pre className="text-[10px] leading-snug font-mono whitespace-pre-wrap break-all text-m3-text/90 m-0">
                {inputText}
              </pre>
            </div>
          ) : null}
          {outputText ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-m3-secondary mb-1">
                {t("ai.chat.toolOutput")}
              </p>
              <pre className="text-[10px] leading-snug font-mono whitespace-pre-wrap break-all text-m3-text/90 m-0">
                {outputText.length > 12_000
                  ? `${outputText.slice(0, 12_000)}\n…`
                  : outputText}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
