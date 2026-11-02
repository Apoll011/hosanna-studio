/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseChordPro } from "@hosanna/chordpro";
import { youtubeApi } from "../../../api/youtube";
import type { Song } from "../../../types";
import { injectChordProDirective } from "./chordProMeta";
import type { LibraryHealthAutoFix } from "./types";
import { extractYouTubeVideoId } from "./youtubeId";

/**
 * Fill a missing `{duration:}` directive from the song's `{youtube:}` URL
 * via the Hosanna API (`/youtube/duration`).
 */
export const durationAutoFix: LibraryHealthAutoFix = {
  id: "fill-youtube-duration",
  criterion: "duration",

  canFix(song: Song): boolean {
    const ast = parseChordPro(song.content || "");
    if (ast.metadata.duration?.trim()) return false;
    const youtube = ast.metadata.youtube?.trim() || "";
    return Boolean(extractYouTubeVideoId(youtube));
  },

  async apply(song: Song) {
    const content = song.content || "";
    const ast = parseChordPro(content);
    if (ast.metadata.duration?.trim()) return null;

    const youtube = ast.metadata.youtube?.trim() || "";
    if (!extractYouTubeVideoId(youtube)) return null;

    try {
      const result = await youtubeApi.getDuration(youtube);
      const duration = result.duration?.trim();
      if (!duration) return null;

      const next = injectChordProDirective(content, "duration", duration);
      if (next === content) return null;
      return { content: next };
    } catch {
      return null;
    }
  },
};
