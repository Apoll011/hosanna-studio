/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AiChatContext, AiUiMessage } from "@/src/api/ai";
import type { TranslationKey } from "@/src/lib/i18n";

export type AiToolCallState = {
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error";
  input?: unknown;
  output?: unknown;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: AiToolCallState[];
  error?: string;
};

export type QuickChip = {
  id: string;
  labelKey: TranslationKey;
  prompt: string;
};

export type PageContextSnapshot = AiChatContext;

export function toUiMessages(messages: AiChatMessage[]): AiUiMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  }));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
