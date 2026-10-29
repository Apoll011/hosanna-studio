/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PageContextSnapshot } from "./types";
import type { QuickChip } from "./types";

export function chipsForContext(ctx: PageContextSnapshot): QuickChip[] {
  switch (ctx.kind) {
    case "song_editor":
      return [
        {
          id: "fix-chordpro",
          labelKey: "ai.chat.chips.fixChordPro",
          prompt:
            "Review and fix the current song's ChordPro (formatting, directives, metadata). Propose edits; do not save yet.",
        },
        {
          id: "review-song",
          labelKey: "ai.chat.chips.reviewSong",
          prompt:
            "Review this song for ChordPro quality, missing metadata, and playability. Summarize issues and propose fixes.",
        },
        {
          id: "transpose",
          labelKey: "ai.chat.chips.transpose",
          prompt:
            "Help me transpose this song. Ask which target key if unclear, then propose the transposed ChordPro.",
        },
        {
          id: "complete-notes",
          labelKey: "ai.chat.chips.completeNotes",
          prompt:
            "Complete Notes: use chordpro_propagate_notes (or chordpro.propagate_notes) on the current song. Copy {c:}/{ci:}/{cb:} notes from the first annotated verse onto the other verses at the same relative places — do NOT invent new notes. Show the diff and propose applying to the editor; do not save yet.",
        },
        {
          id: "complete-meta",
          labelKey: "ai.chat.chips.completeMeta",
          prompt:
            "Complete missing song metadata (title, artist, key, tempo, tags) based on the ChordPro content. Propose edits only.",
        },
        {
          id: "explain",
          labelKey: "ai.chat.chips.explainSelection",
          prompt:
            "Explain the ChordPro structure and any unusual directives in the current song excerpt.",
        },
      ];
    case "service_editor":
      return [
        {
          id: "review-plan",
          labelKey: "ai.chat.chips.reviewPlan",
          prompt:
            "Review this service plan for structure, missing song refs, and flow. Suggest improvements without saving.",
        },
        {
          id: "suggest-songs",
          labelKey: "ai.chat.chips.suggestSongs",
          prompt:
            "Suggest songs from the library that fit this service. Propose a draft plan; do not save yet.",
        },
        {
          id: "fix-refs",
          labelKey: "ai.chat.chips.fixSongRefs",
          prompt:
            "Check song references in this service and fix any broken or incomplete song elements. Propose only.",
        },
        {
          id: "complete-structure",
          labelKey: "ai.chat.chips.completeStructure",
          prompt:
            "Complete a balanced service structure (welcome, songs, message, etc.) for this plan. Propose elements; do not save.",
        },
      ];
    case "songs_list":
      return [
        {
          id: "create-song",
          labelKey: "ai.chat.chips.createSong",
          prompt:
            "Help me create a new ChordPro song. Ask for title/artist if needed, then propose content (do not save until I confirm).",
        },
        {
          id: "search-help",
          labelKey: "ai.chat.chips.searchHelp",
          prompt: "Help me search and organize songs in the library.",
        },
      ];
    case "services_list":
      return [
        {
          id: "plan-service",
          labelKey: "ai.chat.chips.planService",
          prompt:
            "Help me plan a new worship service. Ask for date/theme if needed, then propose a draft setlist from the library.",
        },
      ];
    default:
      return [
        {
          id: "general",
          labelKey: "ai.chat.chips.general",
          prompt:
            "What can you help me with in Hosanna Studio (songs, services, ChordPro)?",
        },
      ];
  }
}
