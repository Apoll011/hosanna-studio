/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TranslateFn, TranslationKey } from "@/src/lib/i18n";
import {
  BookOpen,
  Brain,
  Calendar,
  CalendarPlus,
  Compass,
  FileCode2,
  FileMusic,
  Folder,
  FolderPlus,
  Globe,
  Languages,
  Library,
  ListChecks,
  Music,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  WandSparkles,
  Wrench,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { AiToolCallState } from "./types";

/** Known chat tools → icon. Labels live in `ai.chat.tools.<name>` (i18n). */
const TOOL_ICONS: Record<string, LucideIcon> = {
  hosanna_capabilities: Sparkles,
  hosanna_permissions: ShieldCheck,
  hosanna_skills_list: BookOpen,
  hosanna_skill_read: BookOpen,
  hosanna_resources_list: BookOpen,
  hosanna_resource_read: BookOpen,
  me: User,
  members_list: Users,
  members_get: User,
  members_resolve: Users,
  org_get: Users,
  folders_list: Folder,
  folders_create: FolderPlus,
  folders_update: Folder,
  folders_delete: Trash2,
  folders_restore: RotateCcw,
  trash_list: Trash2,
  collections_list: Library,
  collections_get: Library,
  collections_create: Library,
  collections_update: Library,
  collections_delete: Trash2,
  collections_add_songs: Library,
  collections_remove_songs: Library,
  agenda_list: Calendar,
  agenda_get: Calendar,
  agenda_create: CalendarPlus,
  agenda_update: Calendar,
  agenda_delete: Trash2,
  studio_sync: RefreshCw,
  studio_navigate: Compass,
  studio_generate_pdf: Printer,
  studio_search: Search,
  metadata_musicbrainz_search: Search,
  metadata_youtube_search: Youtube,
  metadata_web_search: Globe,
  metadata_web_fetch: Globe,
  chordpro_validate: ListChecks,
  chordpro_propagate_chords: WandSparkles,
  chordpro_parse_summary: FileCode2,
  chordpro_format: FileCode2,
  chordpro_transpose: Languages,
  chordpro_convert: FileCode2,
  chordpro_directives: FileCode2,
  songs_search: Search,
  songs_list_in_folder: Folder,
  songs_search_lyrics: Search,
  songs_get: Music,
  songs_get_many: Music,
  songs_create_draft: FileMusic,
  songs_propose_edit: WandSparkles,
  songs_propose_fix: WandSparkles,
  songs_propose_transpose: Languages,
  songs_propose_propagate_chords: WandSparkles,
  songs_save: Save,
  songs_move: Music,
  songs_delete: Trash2,
  songs_restore: RotateCcw,
  services_search: Search,
  services_get: Calendar,
  services_validate: ListChecks,
  services_plan_suggest: Sparkles,
  services_propose_edit: WandSparkles,
  services_save: Save,
  services_delete: Trash2,
  services_restore: RotateCcw,
  folders_update_many: Folder,
  folders_create_many: FolderPlus,
  collections_update_many: Library,
  memory_list: Brain,
  memory_save: Brain,
  memory_forget: Brain,
};

export function normalizeToolName(name: string): string {
  return name.replace(/\./g, "_");
}

export function toolIcon(name: string): LucideIcon {
  return TOOL_ICONS[normalizeToolName(name)] ?? Wrench;
}

function prettify(name: string): string {
  const spaced = normalizeToolName(name).replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Human label for a tool (localized when known, prettified otherwise). */
export function toolLabel(name: string, t: TranslateFn): string {
  const norm = normalizeToolName(name);
  if (!(norm in TOOL_ICONS)) return prettify(name);
  const key = `ai.chat.tools.${norm}` as TranslationKey;
  const label = t(key);
  return label === key ? prettify(name) : label;
}

/** Unwrap AI SDK / MCP-style tool output into plain JSON when possible. */
export function parseToolOutput(output: unknown): unknown {
  if (output == null) return output;
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.text === "string") return parseToolOutput(o.text);
    if (Array.isArray(o.content)) {
      const text = (o.content as Array<{ type?: string; text?: string }>)
        .map((c) => (c?.type === "text" ? (c.text ?? "") : ""))
        .join("");
      if (text) return parseToolOutput(text);
    }
  }
  return output;
}

const SUMMARY_KEYS = [
  "name",
  "title",
  "query",
  "search",
  "uri",
  "kind",
  "reason",
  "key",
  "targetKey",
] as const;

function clip(s: string, n = 48): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** One-line description of what a tool call did (shown in the collapsed row). */
export function toolSummary(tool: AiToolCallState): string {
  const input = tool.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const rec = input as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of SUMMARY_KEYS) {
      const v = rec[k];
      if (typeof v === "string" && v.trim()) {
        parts.push(clip(v.trim()));
        break;
      }
    }
    if (typeof rec.color === "string") parts.push(rec.color);
    if (typeof rec.icon === "string") parts.push(rec.icon);
    if (Array.isArray(rec.ids)) parts.push(`${rec.ids.length}×`);
    if (Array.isArray(rec.songIds)) parts.push(`${rec.songIds.length}×`);
    if (parts.length) return parts.join(" · ");
  }
  return "";
}

/** Short result hint (e.g. result counts) for finished tools. */
export function toolResultHint(tool: AiToolCallState): string {
  if (tool.status !== "done") return "";
  const out = parseToolOutput(tool.output);
  if (Array.isArray(out)) return `${out.length}`;
  if (out && typeof out === "object") {
    const rec = out as Record<string, unknown>;
    for (const k of [
      "songs",
      "services",
      "folders",
      "collections",
      "events",
      "items",
      "hits",
      "results",
      "members",
    ]) {
      if (Array.isArray(rec[k])) return `${(rec[k] as unknown[]).length}`;
    }
  }
  return "";
}

export function formatDuration(ms: number | undefined): string {
  if (ms == null || ms < 0) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function toolPayloadText(value: unknown): string {
  if (value == null) return "";
  const parsed = typeof value === "string" ? parseToolOutput(value) : value;
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
}
