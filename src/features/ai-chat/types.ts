/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AiChatContext, AiUiMessage } from "@/src/api/ai";
import type { TranslationKey } from "@/src/lib/i18n";
import type { LucideIcon } from "lucide-react";

export type AiToolCallState = {
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  startedAt?: number;
  endedAt?: number;
};

export type AiMessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; tool: AiToolCallState }
  /** Model step boundary (kept so history round-trips faithfully). */
  | { type: "step" };

export type AiMessageMeta = {
  durationMs?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  steps?: number;
  finishReason?: string;
  /** Tool calls used for this reply and the org limit. */
  toolCalls?: number;
  toolLimit?: number;
  /** Tools were switched off so the model had to write a final answer. */
  limitReached?: boolean;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: AiMessagePart[];
  createdAt: number;
  error?: string;
  /** User pressed Stop while this reply was streaming. */
  aborted?: boolean;
  /** Reply ended because the server hit its step budget. */
  truncated?: boolean;
  meta?: AiMessageMeta;
  /** Suggested follow-up prompts (from `suggest_followups`). */
  followups?: string[];
};

export type AiThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
};

export type AiThreadSummary = Pick<
  AiThread,
  "id" | "title" | "createdAt" | "updatedAt"
> & { messageCount: number };

export type QuickChip = {
  id: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  /** Localized prompt sent as the user message. */
  promptKey: TranslationKey;
};

export type PageContextSnapshot = AiChatContext;

export type LogosMood =
  | "idle"
  | "thinking"
  | "working"
  | "listening"
  | "singing"
  | "happy"
  | "excited"
  | "celebrating"
  | "sleeping"
  | "helping"
  | "oops"
  /* Reaction-only moods (triggered by poking / petting the mascot). */
  | "surprised"
  | "love"
  | "wink"
  | "dizzy";

/** Tools whose cards are noise for the user (hidden from the tool list). */
export const SILENT_TOOLS = new Set(["studio_sync", "suggest_followups"]);

export function messageText(msg: AiChatMessage): string {
  return msg.parts
    .filter(
      (p): p is Extract<AiMessagePart, { type: "text" }> => p.type === "text",
    )
    .map((p) => p.text)
    .join("");
}

const HISTORY_OUTPUT_MAX = 6_000;

function clipForHistory(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > HISTORY_OUTPUT_MAX
      ? `${value.slice(0, HISTORY_OUTPUT_MAX)}\n…[clipped]`
      : value;
  }
  try {
    const json = JSON.stringify(value);
    if (json.length <= HISTORY_OUTPUT_MAX) return value;
    return `${json.slice(0, HISTORY_OUTPUT_MAX)}…[clipped]`;
  } catch {
    return String(value);
  }
}

/**
 * Convert to AI SDK UIMessages. Tool calls round-trip (clipped) so the model
 * keeps ids / `updatedAt` / results from earlier turns.
 */
export function toUiMessages(messages: AiChatMessage[]): AiUiMessage[] {
  const out = messages.map((m) => {
    if (m.role === "user") {
      return {
        id: m.id,
        role: "user" as const,
        parts: [{ type: "text", text: messageText(m) }],
      };
    }
    const parts: AiUiMessage["parts"] = [];
    for (const p of m.parts) {
      if (p.type === "text") {
        if (p.text) parts.push({ type: "text", text: p.text });
      } else if (p.type === "step") {
        parts.push({ type: "step-start" });
      } else if (p.type === "tool" && p.tool.status !== "running") {
        const base = {
          type: `tool-${p.tool.toolName}`,
          toolCallId: p.tool.toolCallId,
          input: p.tool.input ?? {},
        };
        parts.push(
          p.tool.status === "error"
            ? {
                ...base,
                state: "output-error",
                errorText: p.tool.errorText ?? "Tool failed",
              }
            : {
                ...base,
                state: "output-available",
                output: clipForHistory(p.tool.output),
              },
        );
      }
    }
    return { id: m.id, role: "assistant" as const, parts };
  });
  // Drop assistant turns that produced nothing (aborted / errored early).
  return out.filter(
    (m) => m.role === "user" || m.parts.some((p) => p.type !== "step-start"),
  );
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
