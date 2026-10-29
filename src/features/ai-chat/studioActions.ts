/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  dispatchAiNavigate,
  dispatchAiPrint,
  type AiNavigateDetail,
  type AiPrintDetail,
} from "./contextBridge";

function asRecord(output: unknown): Record<string, unknown> | null {
  if (output == null) return null;
  if (typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function parseToolJson(output: unknown): Record<string, unknown> | null {
  const direct = asRecord(output);
  if (direct) {
    if (direct.studioNavigate === true || direct.studioPrint === true) {
      return direct;
    }
    if (typeof direct.text === "string") return parseToolJson(direct.text);
    if (Array.isArray(direct.content)) {
      const text = (
        direct.content as Array<{ type?: string; text?: string }>
      )
        .map((c) => (c?.type === "text" ? c.text ?? "" : ""))
        .join("");
      return text ? parseToolJson(text) : null;
    }
  }
  return direct;
}

export function maybeDispatchStudioActions(
  _toolName: string,
  output: unknown,
) {
  const body = parseToolJson(output);
  if (!body) return;

  if (body.studioNavigate === true && typeof body.kind === "string") {
    const detail: AiNavigateDetail = {
      kind: body.kind,
      id: typeof body.id === "string" ? body.id : (body.id as null) ?? null,
      route: typeof body.route === "string" ? body.route : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    };
    dispatchAiNavigate(detail);
  }

  if (
    body.studioPrint === true &&
    typeof body.kind === "string" &&
    Array.isArray(body.ids)
  ) {
    const ids = body.ids.filter((id): id is string => typeof id === "string");
    if (!ids.length) return;
    const detail: AiPrintDetail = {
      kind: body.kind,
      ids,
      title: typeof body.title === "string" ? body.title : undefined,
      options:
        body.options && typeof body.options === "object"
          ? (body.options as Record<string, unknown>)
          : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    };
    dispatchAiPrint(detail);
  }
}
