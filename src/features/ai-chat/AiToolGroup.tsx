/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import React, { memo, useMemo, useState } from "react";
import { AiConfirmCard } from "./AiConfirmCard";
import { AiProposalCard } from "./AiProposalCard";
import { CopyButton } from "./CopyButton";
import { countByName, toolRunStatus } from "./messageState";
import {
  extractDestructiveConfirmation,
  extractSongProposal,
} from "./proposals";
import {
  formatDuration,
  parseToolOutput,
  toolIcon,
  toolLabel,
  toolPayloadText,
  toolResultHint,
  toolSummary,
} from "./toolMeta";
import type { AiToolCallState } from "./types";

const PAYLOAD_MAX = 12_000;

function clipPayload(text: string): string {
  return text.length > PAYLOAD_MAX ? `${text.slice(0, PAYLOAD_MAX)}\n…` : text;
}

/* ------------------------------ single tool ------------------------------ */

const PayloadBlock: React.FC<{
  title: string;
  text: string;
  error?: boolean;
}> = ({ title, text, error }) => (
  <div>
    <div className="flex items-center justify-between mb-0.5">
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide m-0 ${
          error ? "text-red-500" : "text-m3-secondary"
        }`}
      >
        {title}
      </p>
      <CopyButton text={text} className="p-1" iconClassName="w-3 h-3" />
    </div>
    <pre
      className={`text-[10.5px] leading-snug font-mono whitespace-pre-wrap break-all m-0 max-h-48 overflow-auto rounded-[var(--radius-sm)] border px-2 py-1.5 ${
        error
          ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
          : "border-m3-border/70 bg-m3-bg text-m3-text/90"
      }`}
    >
      {clipPayload(text)}
    </pre>
  </div>
);

const AiToolRow = memo(function AiToolRow({
  tool,
  needsConfirm,
}: {
  tool: AiToolCallState;
  needsConfirm: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const label = toolLabel(tool.toolName, t);
  const summary = useMemo(() => toolSummary(tool), [tool]);
  const hint = useMemo(() => toolResultHint(tool), [tool]);
  const inputText = useMemo(
    () => (open ? toolPayloadText(tool.input) : ""),
    [open, tool.input],
  );
  const outputText = useMemo(
    () => (open ? toolPayloadText(tool.output) : ""),
    [open, tool.output],
  );
  const Icon = toolIcon(tool.toolName);
  const duration =
    tool.endedAt && tool.startedAt ? tool.endedAt - tool.startedAt : undefined;
  const hasDetails = tool.status !== "running" || tool.input !== undefined;

  const statusIcon =
    tool.status === "running" ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin text-m3-primary" />
    ) : tool.status === "error" ? (
      <X className="w-3.5 h-3.5 text-red-500" />
    ) : needsConfirm ? (
      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
    ) : (
      <Check className="w-3.5 h-3.5 text-emerald-500" />
    );

  return (
    <li className="rounded-[var(--radius-md)] border border-m3-border/70 bg-m3-card/70 overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasDetails}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-m3-hover/60 transition-colors disabled:cursor-default"
      >
        <Icon className="w-3.5 h-3.5 shrink-0 text-m3-secondary" />
        <span className="font-medium text-m3-text shrink-0 max-w-[55%] truncate">
          {label}
        </span>
        {summary ? (
          <span className="text-m3-secondary truncate min-w-0 flex-1">
            {summary}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {hint ? (
          <span className="shrink-0 text-[10px] tabular-nums px-1.5 rounded-full bg-m3-sidebar text-m3-secondary">
            {hint}
          </span>
        ) : null}
        {duration != null ? (
          <span className="shrink-0 text-[10px] tabular-nums text-m3-secondary">
            {formatDuration(duration)}
          </span>
        ) : null}
        {statusIcon}
        {hasDetails && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-m3-secondary transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {open && (
        <div className="border-t border-m3-border/70 px-2 py-2 space-y-2 bg-m3-bg/40">
          {tool.status === "error" && tool.errorText ? (
            <PayloadBlock
              title={t("ai.chat.toolErrorDetail")}
              text={tool.errorText}
              error
            />
          ) : null}
          {inputText ? (
            <PayloadBlock title={t("ai.chat.toolInput")} text={inputText} />
          ) : null}
          {outputText ? (
            <PayloadBlock title={t("ai.chat.toolOutput")} text={outputText} />
          ) : null}
        </div>
      )}
    </li>
  );
});

/* ------------------------------ grouped run ------------------------------ */

const MAX_NAMES = 3;

/**
 * Sequential tool calls collapsed into one text-only line. Click to reveal the
 * list; click a row to reveal that tool's input / result.
 */
export const AiToolGroup = memo(function AiToolGroup({
  tools,
}: {
  tools: AiToolCallState[];
}) {
  const { t, tc } = useI18n();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  const run = useMemo(() => toolRunStatus(tools), [tools]);
  const names = useMemo(() => countByName(tools), [tools]);
  const confirmations = useMemo(
    () =>
      tools.map((tool) =>
        tool.status === "done"
          ? extractDestructiveConfirmation(tool.output)
          : null,
      ),
    [tools],
  );

  const songProposals = useMemo(
    () =>
      tools.map((tool) => {
        if (tool.status !== "done") return null;
        const p = extractSongProposal(parseToolOutput(tool.output));
        return p?.id ? { ...p, id: p.id } : null;
      }),
    [tools],
  );

  const current = useMemo(() => {
    for (let i = tools.length - 1; i >= 0; i--) {
      if (tools[i].status === "running") return tools[i];
    }
    return null;
  }, [tools]);

  const finished = run.done + run.failed;
  const namesText = names
    .slice(0, MAX_NAMES)
    .map(([n, c]) => `${toolLabel(n, t)}${c > 1 ? ` ×${c}` : ""}`)
    .join(", ");
  const extra = names.length > MAX_NAMES ? ` +${names.length - MAX_NAMES}` : "";

  const headline =
    run.status === "running"
      ? t("ai.chat.toolsWorking", { done: finished, total: tools.length })
      : tc("ai.chat.toolsUsed", tools.length);
  const detail =
    run.status === "running" && current
      ? toolLabel(current.toolName, t)
      : `${namesText}${extra}`;

  const toggle = () => {
    setOpen((v) => !v);
    setEverOpened(true);
  };

  return (
    <div className="my-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={t("ai.chat.toolsToggle")}
        className="group max-w-full inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-1.5 py-1 -mx-1.5 text-left text-[12px] text-m3-secondary hover:bg-m3-hover/70 hover:text-m3-text transition-colors"
      >
        {run.status === "running" ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-m3-primary" />
        ) : run.status === "error" ? (
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
        ) : (
          <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="font-medium text-m3-text shrink-0">{headline}</span>
        {detail ? <span className="truncate min-w-0">· {detail}</span> : null}
        {run.failed > 0 && run.status !== "running" ? (
          <span className="shrink-0 text-red-500">
            · {t("ai.chat.toolsFailed", { count: run.failed })}
          </span>
        ) : null}
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      <div className="logos-collapse" data-open={open}>
        <div>
          {everOpened && (
            <ul className="list-none m-0 mt-1.5 p-0 space-y-1">
              {tools.map((tool, i) => (
                <AiToolRow
                  key={tool.toolCallId}
                  tool={tool}
                  needsConfirm={Boolean(confirmations[i])}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Song edits can be reviewed and applied right here. */}
      {songProposals.map((p, i) =>
        p ? (
          <AiProposalCard key={`p-${tools[i].toolCallId}`} proposal={p} />
        ) : null,
      )}

      {/* Pending confirmations stay visible even while the list is collapsed. */}
      {confirmations.map((c, i) =>
        c ? <AiConfirmCard key={tools[i].toolCallId} confirmation={c} /> : null,
      )}
    </div>
  );
});
