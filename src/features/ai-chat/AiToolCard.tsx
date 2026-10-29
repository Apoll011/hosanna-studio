/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { AiDiffView } from "./AiDiffView";
import {
  dispatchApplyService,
  dispatchApplySong,
} from "./contextBridge";
import type { AiToolCallState } from "./types";

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractDiffPreview(output: unknown): string | null {
  const parsed = tryParseJson(output) as Record<string, unknown> | unknown;
  if (!parsed || typeof parsed !== "object") return null;
  const diff = (parsed as { diff?: { preview?: string } }).diff;
  return typeof diff?.preview === "string" ? diff.preview : null;
}

function extractSongProposal(output: unknown): {
  id?: string;
  content: string;
  title?: string;
  artist?: string;
} | null {
  const parsed = tryParseJson(output) as {
    proposal?: {
      id?: string;
      content?: string;
      title?: string;
      artist?: string;
    };
  } | null;
  const proposal = parsed?.proposal;
  if (!proposal?.content || typeof proposal.content !== "string") return null;
  return {
    id: proposal.id,
    content: proposal.content,
    title: proposal.title,
    artist: proposal.artist,
  };
}

function extractServiceProposal(output: unknown): {
  serviceId?: string;
  name?: string;
  notes?: string;
  elements: unknown[];
} | null {
  const parsed = tryParseJson(output) as {
    proposal?: {
      id?: string;
      name?: string;
      notes?: string;
      elements?: unknown[];
    };
  } | null;
  const proposal = parsed?.proposal;
  if (!proposal?.elements || !Array.isArray(proposal.elements)) return null;
  return {
    serviceId: proposal.id,
    name: proposal.name,
    notes: proposal.notes,
    elements: proposal.elements,
  };
}

export const AiToolCard: React.FC<{ tool: AiToolCallState }> = ({ tool }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const diffPreview = useMemo(
    () => extractDiffPreview(tool.output),
    [tool.output],
  );
  const songProposal = useMemo(
    () => extractSongProposal(tool.output),
    [tool.output],
  );
  const serviceProposal = useMemo(
    () => extractServiceProposal(tool.output),
    [tool.output],
  );

  const statusIcon =
    tool.status === "running" ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin text-m3-primary" />
    ) : tool.status === "error" ? (
      <X className="w-3.5 h-3.5 text-red-500" />
    ) : (
      <Check className="w-3.5 h-3.5 text-emerald-500" />
    );

  const statusLabel =
    tool.status === "running"
      ? t("ai.chat.toolRunning")
      : tool.status === "error"
        ? t("ai.chat.toolError")
        : t("ai.chat.toolDone");

  return (
    <div className="rounded-[var(--radius-md)] border border-m3-border bg-m3-card/80 overflow-hidden text-xs">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-m3-sidebar/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
        )}
        {statusIcon}
        <span className="font-medium text-m3-text truncate flex-1">
          {tool.toolName}
        </span>
        <span className="text-m3-secondary shrink-0">{statusLabel}</span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-m3-border pt-2">
          {diffPreview && <AiDiffView preview={diffPreview} />}
          {tool.output != null && (
            <pre className="text-[10px] font-mono text-m3-secondary whitespace-pre-wrap max-h-40 overflow-auto bg-m3-sidebar/40 rounded-[var(--radius-sm)] p-2 m-0">
              {typeof tool.output === "string"
                ? tool.output
                : JSON.stringify(tool.output, null, 2)}
            </pre>
          )}
          {songProposal && (
            <button
              type="button"
              className="w-full rounded-[var(--radius-md)] bg-m3-primary text-white text-xs font-medium py-1.5 px-2 hover:opacity-90 transition-opacity"
              onClick={() =>
                dispatchApplySong({
                  songId: songProposal.id,
                  content: songProposal.content,
                  title: songProposal.title,
                  artist: songProposal.artist,
                })
              }
            >
              {t("ai.chat.applyToEditor")}
            </button>
          )}
          {serviceProposal && (
            <button
              type="button"
              className="w-full rounded-[var(--radius-md)] bg-m3-primary text-white text-xs font-medium py-1.5 px-2 hover:opacity-90 transition-opacity"
              onClick={() =>
                dispatchApplyService({
                  serviceId: serviceProposal.serviceId,
                  name: serviceProposal.name,
                  notes: serviceProposal.notes,
                  elements: serviceProposal.elements as never,
                })
              }
            >
              {t("ai.chat.applyToEditor")}
            </button>
          )}
        </div>
      )}

      {!open && diffPreview && (
        <div className="px-2.5 pb-2">
          <AiDiffView preview={diffPreview} />
          {songProposal && (
            <button
              type="button"
              className="mt-2 w-full rounded-[var(--radius-md)] bg-m3-primary text-white text-xs font-medium py-1.5 px-2 hover:opacity-90 transition-opacity"
              onClick={() =>
                dispatchApplySong({
                  songId: songProposal.id,
                  content: songProposal.content,
                  title: songProposal.title,
                  artist: songProposal.artist,
                })
              }
            >
              {t("ai.chat.applyToEditor")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
