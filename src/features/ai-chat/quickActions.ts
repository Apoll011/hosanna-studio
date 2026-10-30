/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Calendar,
  CalendarClock,
  CircleHelp,
  FilePlus2,
  FileSearch,
  Info,
  Languages,
  ListChecks,
  ListMusic,
  Music,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/src/lib/i18n";
import type { PageContextSnapshot, QuickChip } from "./types";

type ChipId =
  | "fixChordPro"
  | "reviewSong"
  | "transpose"
  | "completeChords"
  | "completeMeta"
  | "explainSelection"
  | "reviewPlan"
  | "suggestSongs"
  | "fixSongRefs"
  | "completeStructure"
  | "createSong"
  | "searchHelp"
  | "planService"
  | "organizeFolders"
  | "upcomingAgenda"
  | "reviewTrash"
  | "general";

const ICONS: Record<ChipId, LucideIcon> = {
  fixChordPro: WandSparkles,
  reviewSong: ShieldCheck,
  transpose: Languages,
  completeChords: Music,
  completeMeta: Tags,
  explainSelection: Info,
  reviewPlan: ListChecks,
  suggestSongs: ListMusic,
  fixSongRefs: FileSearch,
  completeStructure: Calendar,
  createSong: FilePlus2,
  searchHelp: Search,
  planService: CalendarClock,
  organizeFolders: Palette,
  upcomingAgenda: CalendarClock,
  reviewTrash: Trash2,
  general: CircleHelp,
};

/** Every label/description/prompt is an i18n key — nothing is hardcoded. */
function chip(id: ChipId): QuickChip {
  return {
    id,
    icon: ICONS[id] ?? Sparkles,
    labelKey: `ai.chat.chips.${id}` as TranslationKey,
    descKey: `ai.chat.chipDesc.${id}` as TranslationKey,
    promptKey: `ai.chat.chipPrompt.${id}` as TranslationKey,
  };
}

const BY_KIND: Record<string, ChipId[]> = {
  song_editor: [
    "fixChordPro",
    "reviewSong",
    "transpose",
    "completeChords",
    "completeMeta",
    "explainSelection",
  ],
  service_editor: [
    "reviewPlan",
    "suggestSongs",
    "fixSongRefs",
    "completeStructure",
  ],
  songs_list: ["createSong", "organizeFolders", "searchHelp"],
  services_list: ["planService", "upcomingAgenda"],
  explorer: ["organizeFolders", "createSong", "searchHelp"],
  collection_detail: ["suggestSongs", "searchHelp"],
  agenda: ["upcomingAgenda", "planService"],
  trash: ["reviewTrash", "general"],
};

const GENERAL: ChipId[] = [
  "general",
  "createSong",
  "planService",
  "organizeFolders",
];

export function chipsForContext(ctx: PageContextSnapshot): QuickChip[] {
  const ids = (ctx.kind && BY_KIND[ctx.kind]) || GENERAL;
  return ids.map(chip);
}

/** Slash-menu entries: every known chip (page-relevant first). */
export function allChips(ctx: PageContextSnapshot): QuickChip[] {
  const first = chipsForContext(ctx);
  const seen = new Set(first.map((c) => c.id));
  const rest = (Object.keys(ICONS) as ChipId[])
    .filter((id) => !seen.has(id))
    .map(chip);
  return [...first, ...rest];
}
