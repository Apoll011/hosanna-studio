/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StreamEvent } from "./stream";
import {
  SILENT_TOOLS,
  type AiChatMessage,
  type AiMessageMeta,
  type AiMessagePart,
  type AiToolCallState,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Pure stream reducer (immutable)                                             */
/* -------------------------------------------------------------------------- */

function upsertTool(
  parts: AiMessagePart[],
  toolCallId: string,
  update: (prev: AiToolCallState | undefined) => AiToolCallState,
): AiMessagePart[] {
  const idx = parts.findIndex(
    (p) => p.type === "tool" && p.tool.toolCallId === toolCallId,
  );
  if (idx >= 0) {
    const prev = (parts[idx] as Extract<AiMessagePart, { type: "tool" }>).tool;
    const next = [...parts];
    next[idx] = { type: "tool", tool: update(prev) };
    return next;
  }
  return [...parts, { type: "tool", tool: update(undefined) }];
}

function appendText(
  parts: AiMessagePart[],
  kind: "text" | "reasoning",
  delta: string,
): AiMessagePart[] {
  const last = parts[parts.length - 1];
  if (last && last.type === kind) {
    const next = parts.slice(0, -1);
    next.push({ type: kind, text: last.text + delta });
    return next;
  }
  return [...parts, { type: kind, text: delta }];
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function readMeta(raw: unknown): AiMessageMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const usage = (m.usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    durationMs: num(m.durationMs),
    model: typeof m.model === "string" ? m.model : undefined,
    steps: num(m.steps),
    inputTokens: num(usage.inputTokens),
    outputTokens: num(usage.outputTokens),
    finishReason:
      typeof m.finishReason === "string" ? m.finishReason : undefined,
    toolCalls: num(m.toolCalls),
    toolLimit: num(m.toolLimit),
    limitReached: m.limitReached === true ? true : undefined,
  };
}

function followupsFromInput(input: unknown): string[] | undefined {
  if (!input || typeof input !== "object") return undefined;
  const options = (input as { options?: unknown }).options;
  if (!Array.isArray(options)) return undefined;
  const list = options
    .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    .map((o) => o.trim())
    .slice(0, 4);
  return list.length ? list : undefined;
}

/** Apply one UI-message stream event to an assistant message. */
export function applyStreamEvent(
  msg: AiChatMessage,
  event: StreamEvent,
  now = Date.now(),
): AiChatMessage {
  switch (event.type) {
    case "text-delta": {
      const delta = str(event.delta);
      return delta
        ? { ...msg, parts: appendText(msg.parts, "text", delta) }
        : msg;
    }
    case "reasoning-delta": {
      const delta = str(event.delta);
      return delta
        ? { ...msg, parts: appendText(msg.parts, "reasoning", delta) }
        : msg;
    }
    case "start-step": {
      if (msg.parts.length === 0) return msg;
      const last = msg.parts[msg.parts.length - 1];
      if (last.type === "step") return msg;
      return { ...msg, parts: [...msg.parts, { type: "step" }] };
    }
    case "tool-input-start": {
      const id = str(event.toolCallId);
      return {
        ...msg,
        parts: upsertTool(msg.parts, id, (prev) => ({
          ...(prev ?? { toolCallId: id, toolName: "tool" }),
          toolName: str(event.toolName, prev?.toolName ?? "tool"),
          status: "running",
          startedAt: prev?.startedAt ?? now,
        })),
      };
    }
    case "tool-input-available": {
      const id = str(event.toolCallId);
      return {
        ...msg,
        parts: upsertTool(msg.parts, id, (prev) => ({
          ...(prev ?? { toolCallId: id, toolName: "tool" }),
          toolName: str(event.toolName, prev?.toolName ?? "tool"),
          status: prev?.status ?? "running",
          input: event.input,
          startedAt: prev?.startedAt ?? now,
        })),
      };
    }
    case "tool-input-error":
    case "tool-output-error": {
      const id = str(event.toolCallId);
      return {
        ...msg,
        parts: upsertTool(msg.parts, id, (prev) => ({
          ...(prev ?? { toolCallId: id, toolName: "tool" }),
          toolName: str(event.toolName, prev?.toolName ?? "tool"),
          status: "error",
          input: event.input ?? prev?.input,
          errorText: str(event.errorText, "Tool failed"),
          startedAt: prev?.startedAt ?? now,
          endedAt: now,
        })),
      };
    }
    case "tool-output-available": {
      const id = str(event.toolCallId);
      let followups = msg.followups;
      const parts = upsertTool(msg.parts, id, (prev) => {
        const next: AiToolCallState = {
          ...(prev ?? { toolCallId: id, toolName: "tool" }),
          status: "done",
          output: event.output,
          startedAt: prev?.startedAt ?? now,
          endedAt: now,
        };
        if (next.toolName === "suggest_followups") {
          followups = followupsFromInput(next.input) ?? followups;
        }
        return next;
      });
      return { ...msg, parts, followups };
    }
    case "start":
    case "message-metadata":
    case "finish": {
      const meta = readMeta(event.messageMetadata);
      const finishReason =
        str((event as { finishReason?: unknown }).finishReason) || undefined;
      if (!meta && !finishReason) return msg;
      const merged: AiMessageMeta = {
        ...msg.meta,
        ...Object.fromEntries(
          Object.entries(meta ?? {}).filter(([, v]) => v !== undefined),
        ),
        ...(finishReason ? { finishReason } : {}),
      };
      const rawMeta = (event.messageMetadata ?? {}) as Record<string, unknown>;
      return {
        ...msg,
        meta: merged,
        truncated: msg.truncated || rawMeta.truncated === true,
      };
    }
    case "abort":
      return { ...msg, aborted: true };
    case "error":
      return {
        ...msg,
        error: str(event.errorText, "AI stream error"),
      };
    default:
      return msg;
  }
}

/** Mark any tool still "running" as errored/stopped (stream ended or aborted). */
export function settleRunningTools(
  msg: AiChatMessage,
  reason: string,
  now = Date.now(),
): AiChatMessage {
  if (
    !msg.parts.some((p) => p.type === "tool" && p.tool.status === "running")
  ) {
    return msg;
  }
  return {
    ...msg,
    parts: msg.parts.map((p) =>
      p.type === "tool" && p.tool.status === "running"
        ? {
            type: "tool" as const,
            tool: {
              ...p.tool,
              status: "error" as const,
              errorText: reason,
              endedAt: now,
            },
          }
        : p,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Render blocks: text / reasoning / collapsed tool runs                       */
/* -------------------------------------------------------------------------- */

export type RenderBlock =
  | { kind: "text"; key: string; text: string }
  | { kind: "reasoning"; key: string; text: string }
  | { kind: "tools"; key: string; tools: AiToolCallState[] };

/**
 * Collapse sequential tool calls (ignoring step markers, silent tools and
 * whitespace-only text between them) into a single "tools" block.
 */
export function groupParts(parts: AiMessagePart[]): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  parts.forEach((part, i) => {
    if (part.type === "step") return;
    if (part.type === "tool") {
      if (SILENT_TOOLS.has(part.tool.toolName)) return;
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "tools") {
        last.tools = [...last.tools, part.tool];
      } else {
        blocks.push({
          kind: "tools",
          key: `tools-${part.tool.toolCallId}`,
          tools: [part.tool],
        });
      }
      return;
    }
    if (!part.text.trim()) return;
    blocks.push({
      kind: part.type,
      key: `${part.type}-${i}`,
      text: part.text,
    });
  });
  return blocks;
}

export type ToolRunStatus = "running" | "error" | "done";

export function toolRunStatus(tools: AiToolCallState[]): {
  status: ToolRunStatus;
  running: number;
  failed: number;
  done: number;
} {
  let running = 0;
  let failed = 0;
  let done = 0;
  for (const t of tools) {
    if (t.status === "running") running++;
    else if (t.status === "error") failed++;
    else done++;
  }
  return {
    status: running > 0 ? "running" : failed > 0 ? "error" : "done",
    running,
    failed,
    done,
  };
}

/** `[["folders_update", 6], ["studio_sync", 1]]` in first-seen order. */
export function countByName(tools: AiToolCallState[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of tools)
    counts.set(t.toolName, (counts.get(t.toolName) ?? 0) + 1);
  return [...counts.entries()];
}
