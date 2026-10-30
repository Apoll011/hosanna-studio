/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  CornerDownRight,
  Pencil,
  RefreshCw,
  Square,
} from "lucide-react";
import React, { memo, useMemo, useRef, useState } from "react";
import { AiChatMarkdown } from "./AiChatMarkdown";
import { AiToolGroup } from "./AiToolGroup";
import { CopyButton } from "./CopyButton";
import { LogosMascot } from "./LogosMascot";
import { groupParts } from "./messageState";
import { formatDuration } from "./toolMeta";
import { messageText, type AiChatMessage, type LogosMood } from "./types";

type Props = {
  msg: AiChatMessage;
  isLast: boolean;
  streaming: boolean;
  /** Live mood — only meaningful for the last assistant message. */
  mood: LogosMood;
  onRegenerate: () => void;
  onEdit: (id: string, text: string) => void;
  onSend: (text: string) => void;
};

const ACTIONS =
  "flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity";

/* -------------------------------- user turn ------------------------------- */

const UserMessage: React.FC<Pick<Props, "msg" | "streaming" | "onEdit">> = ({
  msg,
  streaming,
  onEdit,
}) => {
  const { t } = useI18n();
  const text = messageText(msg);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const next = draft.trim();
    if (!next) return;
    setEditing(false);
    onEdit(msg.id, next);
  };

  if (editing) {
    return (
      <div className="w-full max-w-[92%] space-y-1.5">
        <textarea
          ref={areaRef}
          autoFocus
          value={draft}
          rows={Math.min(8, Math.max(2, draft.split("\n").length))}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              setEditing(false);
              setDraft(text);
            }
          }}
          className="w-full resize-none rounded-[var(--radius-lg)] border border-m3-primary bg-m3-bg text-m3-text text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-m3-primary/25"
        />
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(text);
            }}
            className="text-[11px] px-2.5 py-1 rounded-[var(--radius-md)] border border-m3-border text-m3-text hover:bg-m3-hover"
          >
            {t("ai.chat.decline")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="text-[11px] px-2.5 py-1 rounded-[var(--radius-md)] bg-m3-primary text-white disabled:opacity-40"
          >
            {t("ai.chat.send")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex flex-col items-end gap-0.5 max-w-[92%]">
      <div className="rounded-[var(--radius-lg)] rounded-br-[var(--radius-sm)] px-3 py-2 text-[13px] leading-relaxed bg-m3-primary text-white whitespace-pre-wrap break-words">
        {text}
      </div>
      <div className={ACTIONS}>
        <CopyButton text={text} className="p-1" />
        {!streaming && (
          <button
            type="button"
            onClick={() => {
              setDraft(text);
              setEditing(true);
            }}
            title={t("ai.chat.editMessage")}
            aria-label={t("ai.chat.editMessage")}
            className="p-1 rounded-[var(--radius-sm)] text-m3-secondary hover:text-m3-text hover:bg-m3-hover"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------ reasoning block --------------------------- */

const ReasoningBlock: React.FC<{ text: string; live: boolean }> = ({
  text,
  live,
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] text-m3-secondary hover:text-m3-text rounded-[var(--radius-md)] px-1.5 py-1 -mx-1.5 hover:bg-m3-hover/70"
      >
        <Brain
          className={`w-3.5 h-3.5 ${live ? "animate-pulse text-m3-primary" : ""}`}
        />
        <span>{t("ai.chat.reasoning")}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      <div className="logos-collapse" data-open={open}>
        <div>
          <p className="m-0 mt-1 pl-2 border-l-2 border-m3-border text-[12px] leading-relaxed text-m3-secondary whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ assistant turn ---------------------------- */

const AssistantMessage: React.FC<Props> = ({
  msg,
  isLast,
  streaming,
  mood,
  onRegenerate,
  onSend,
}) => {
  const { t } = useI18n();
  const blocks = useMemo(() => groupParts(msg.parts), [msg.parts]);
  const live = isLast && streaming;
  const lastBlock = blocks[blocks.length - 1];
  const text = messageText(msg);
  const duration = formatDuration(msg.meta?.durationMs);

  return (
    <div className="group/msg flex items-start gap-2 w-full">
      <LogosMascot
        flat
        size={26}
        mood={live ? mood : "idle"}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        {blocks.length === 0 && live ? (
          <div
            className="flex items-center gap-2 py-1.5 text-[12px] text-m3-secondary"
            role="status"
          >
            <span className="inline-flex items-center gap-1" aria-hidden>
              <span className="logos-dot" />
              <span className="logos-dot" />
              <span className="logos-dot" />
            </span>
            {t("ai.chat.thinking")}
          </div>
        ) : null}

        <div aria-live={live ? "polite" : "off"}>
          {blocks.map((block, i) => {
            if (block.kind === "tools") {
              return <AiToolGroup key={block.key} tools={block.tools} />;
            }
            if (block.kind === "reasoning") {
              return (
                <ReasoningBlock
                  key={block.key}
                  text={block.text}
                  live={live && i === blocks.length - 1}
                />
              );
            }
            const streamingThis = live && i === blocks.length - 1;
            return (
              <div
                key={block.key}
                className={`text-m3-text text-[13px] leading-relaxed break-words [&>:first-child]:mt-0 [&>:last-child]:mb-0 ${
                  streamingThis ? "logos-streaming" : ""
                }`}
              >
                <AiChatMarkdown>{block.text}</AiChatMarkdown>
              </div>
            );
          })}
        </div>

        {live && lastBlock?.kind === "tools" ? (
          <div className="flex items-center gap-2 py-1 text-[12px] text-m3-secondary">
            <span className="inline-flex items-center gap-1" aria-hidden>
              <span className="logos-dot" />
              <span className="logos-dot" />
              <span className="logos-dot" />
            </span>
          </div>
        ) : null}

        {msg.error ? (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/5 px-2.5 py-2 text-[12px] text-red-600 dark:text-red-400"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words">{msg.error}</span>
            {isLast && !streaming ? (
              <button
                type="button"
                onClick={onRegenerate}
                className="shrink-0 inline-flex items-center gap-1 font-medium hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                {t("ai.chat.retry")}
              </button>
            ) : null}
          </div>
        ) : null}

        {msg.aborted && !live ? (
          <p className="mt-1.5 mb-0 inline-flex items-center gap-1 text-[11px] text-m3-secondary">
            <Square className="w-2.5 h-2.5" />
            {t("ai.chat.stopped")}
          </p>
        ) : null}

        {msg.truncated && !live ? (
          <div className="mt-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[12px] text-m3-text">
            <span className="flex-1 min-w-0">
              {t("ai.chat.truncatedNotice")}
            </span>
            {isLast ? (
              <button
                type="button"
                onClick={() => onSend(t("ai.chat.continue"))}
                className="shrink-0 font-medium text-m3-primary hover:underline"
              >
                {t("ai.chat.continue")}
              </button>
            ) : null}
          </div>
        ) : null}

        {!live && text ? (
          <div className={`${ACTIONS} mt-1 -ml-1`}>
            <CopyButton text={text} className="p-1" />
            {isLast ? (
              <button
                type="button"
                onClick={onRegenerate}
                title={t("ai.chat.regenerate")}
                aria-label={t("ai.chat.regenerate")}
                className="p-1 rounded-[var(--radius-sm)] text-m3-secondary hover:text-m3-text hover:bg-m3-hover"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            ) : null}
            {duration ? (
              <span className="ml-1 text-[10px] tabular-nums text-m3-secondary">
                {duration}
              </span>
            ) : null}
          </div>
        ) : null}

        {isLast && !streaming && msg.followups?.length ? (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("ai.chat.followups")}
          >
            {msg.followups.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onSend(f)}
                className="inline-flex items-center gap-1 max-w-full text-[12px] px-2.5 py-1 rounded-full border border-m3-border bg-m3-card text-m3-text hover:border-m3-primary/50 hover:bg-m3-primary/5 transition-colors"
              >
                <CornerDownRight className="w-3 h-3 shrink-0 text-m3-primary" />
                <span className="truncate">{f}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* --------------------------------- public --------------------------------- */

export const AiChatMessageView = memo(function AiChatMessageView(props: Props) {
  return (
    <div
      className={`logos-msg-in flex ${
        props.msg.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {props.msg.role === "user" ? (
        <UserMessage
          msg={props.msg}
          streaming={props.streaming}
          onEdit={props.onEdit}
        />
      ) : (
        <AssistantMessage {...props} />
      )}
    </div>
  );
});
