/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool names whose successful Studio chat output should pull RxDB replication.
 * Keep aligned with Hosanna-server/src/mcp/lib/studioUi.ts STUDIO_SYNC_AFTER_TOOLS.
 */
const STUDIO_SYNC_AFTER_TOOLS = new Set([
  "folders_create",
  "folders_update",
  "folders_create_many",
  "folders_update_many",
  "folders_restore",
  "collections_create",
  "collections_update",
  "collections_update_many",
  "collections_add_songs",
  "collections_remove_songs",
  "songs_save",
  "songs_move",
  "songs_restore",
  "services_save",
  "services_restore",
  "agenda_create",
  "agenda_update",
  "trash_restore",
  "studio_sync",
]);

function normalizeToolName(toolName: string): string {
  return toolName.replace(/\./g, "_");
}

function outputRequestsSync(output: unknown): boolean {
  if (output == null) return false;
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output) as { studioSync?: boolean };
      return parsed.studioSync === true;
    } catch {
      return (
        output.includes('"studioSync":true') ||
        output.includes('"studioSync": true')
      );
    }
  }
  if (typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (o.studioSync === true) return true;
  if (typeof o.text === "string") return outputRequestsSync(o.text);
  if (Array.isArray(o.content)) {
    const text = (o.content as Array<{ type?: string; text?: string }>)
      .map((c) => (c?.type === "text" ? (c.text ?? "") : ""))
      .join("");
    return text ? outputRequestsSync(text) : false;
  }
  return false;
}

export function shouldStudioSyncAfterTool(
  toolName: string,
  output?: unknown,
): boolean {
  const name = normalizeToolName(toolName);
  if (STUDIO_SYNC_AFTER_TOOLS.has(name)) return true;
  return outputRequestsSync(output);
}
