import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStreamEvent,
  countByName,
  groupParts,
  settleRunningTools,
  toolRunStatus,
} from "./messageState";
import type { StreamEvent } from "./stream";
import { toUiMessages, type AiChatMessage } from "./types";

const base = (): AiChatMessage => ({
  id: "a1",
  role: "assistant",
  parts: [],
  createdAt: 0,
});

const run = (events: StreamEvent[], msg = base()) =>
  events.reduce((m, e, i) => applyStreamEvent(m, e, 1000 + i), msg);

const toolEvents = (id: string, name: string): StreamEvent[] => [
  { type: "tool-input-start", toolCallId: id, toolName: name },
  { type: "tool-input-available", toolCallId: id, toolName: name, input: {} },
  { type: "tool-output-available", toolCallId: id, output: { ok: true } },
];

test("sequential tool calls collapse into one group; text splits groups", () => {
  const msg = run([
    { type: "text-delta", id: "t", delta: "Working " },
    { type: "text-delta", id: "t", delta: "on it." },
    ...toolEvents("1", "folders_update"),
    ...toolEvents("2", "folders_update"),
    ...toolEvents("3", "studio_sync"), // silent
    { type: "start-step" },
    ...toolEvents("4", "folders_update"),
    { type: "text-delta", id: "t2", delta: "Done" },
    ...toolEvents("5", "songs_get"),
  ]);
  const blocks = groupParts(msg.parts);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["text", "tools", "text", "tools"],
  );
  const first = blocks[1];
  assert.equal(first.kind === "tools" && first.tools.length, 3);
  assert.deepEqual(countByName(first.kind === "tools" ? first.tools : []), [
    ["folders_update", 3],
  ]);
});

test("tool errors are surfaced instead of staying 'running'", () => {
  const msg = run([
    { type: "tool-input-start", toolCallId: "1", toolName: "songs_save" },
    { type: "tool-output-error", toolCallId: "1", errorText: "stale" },
  ]);
  const part = msg.parts[0];
  assert.equal(part.type === "tool" && part.tool.status, "error");
  assert.equal(part.type === "tool" && part.tool.errorText, "stale");
  const status = toolRunStatus(part.type === "tool" ? [part.tool] : []);
  assert.equal(status.status, "error");
  assert.equal(status.failed, 1);
});

test("reducer is immutable", () => {
  const before = base();
  const after = applyStreamEvent(before, {
    type: "text-delta",
    id: "t",
    delta: "hi",
  });
  assert.notEqual(before, after);
  assert.equal(before.parts.length, 0);
});

test("metadata + finish set meta and truncated flag", () => {
  const msg = run([
    {
      type: "start",
      messageMetadata: { model: "m1" },
    },
    {
      type: "finish",
      finishReason: "tool-calls",
      messageMetadata: {
        truncated: true,
        durationMs: 1234,
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    },
  ]);
  assert.equal(msg.truncated, true);
  assert.equal(msg.meta?.model, "m1");
  assert.equal(msg.meta?.durationMs, 1234);
  assert.equal(msg.meta?.outputTokens, 5);
});

test("suggest_followups populates followups", () => {
  const msg = run([
    {
      type: "tool-input-available",
      toolCallId: "f",
      toolName: "suggest_followups",
      input: { options: ["Transpose to D", " ", "Save it"] },
    },
    { type: "tool-output-available", toolCallId: "f", output: "{}" },
  ]);
  assert.deepEqual(msg.followups, ["Transpose to D", "Save it"]);
  assert.equal(groupParts(msg.parts).length, 0);
});

test("settleRunningTools stops spinners after abort", () => {
  const running = run([
    { type: "tool-input-start", toolCallId: "1", toolName: "songs_get" },
  ]);
  const settled = settleRunningTools(running, "stopped", 2000);
  const part = settled.parts[0];
  assert.equal(part.type === "tool" && part.tool.status, "error");
});

test("history round-trips tool calls and drops empty assistant turns", () => {
  const assistant = run([
    { type: "text-delta", id: "t", delta: "Let me check" },
    { type: "start-step" },
    ...toolEvents("1", "songs_get"),
    { type: "start-step" },
    { type: "text-delta", id: "t2", delta: "Found it" },
  ]);
  const ui = toUiMessages([
    {
      id: "u",
      role: "user",
      createdAt: 0,
      parts: [{ type: "text", text: "q" }],
    },
    assistant,
    { id: "e", role: "assistant", createdAt: 0, parts: [] },
  ]);
  assert.equal(ui.length, 2);
  const types = ui[1].parts.map((p) => p.type);
  assert.deepEqual(types, [
    "text",
    "step-start",
    "tool-songs_get",
    "step-start",
    "text",
  ]);
  const tool = ui[1].parts[2] as unknown as {
    state: string;
    toolCallId: string;
  };
  assert.equal(tool.state, "output-available");
  assert.equal(tool.toolCallId, "1");
});
