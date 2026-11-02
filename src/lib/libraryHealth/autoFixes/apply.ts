/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from "../../../db";
import type { Song } from "../../../types";
import type { ScoreMissingCriterion } from "./types";
import { getAutoFixForCriterion, listAutoFixes } from "./registry";

export interface ApplyAutoFixesOptions {
  /** Limit to one criterion (e.g. fix-all for a category). */
  criterion?: ScoreMissingCriterion;
  /** Limit to specific song ids. */
  songIds?: string[];
}

export interface ApplyAutoFixesResult {
  fixed: number;
  skipped: number;
}

/**
 * Apply registered auto-fixes to matching songs (content patches via local DB).
 * Reactive song queries will pick up score changes after each write.
 */
export async function applyLibraryHealthAutoFixes(
  songs: Song[],
  options: ApplyAutoFixesOptions = {},
): Promise<ApplyAutoFixesResult> {
  const idFilter = options.songIds ? new Set(options.songIds) : null;
  const fixers = options.criterion
    ? ([getAutoFixForCriterion(options.criterion)].filter(
        Boolean,
      ) as ReturnType<typeof listAutoFixes>)
    : listAutoFixes();

  if (fixers.length === 0) {
    return { fixed: 0, skipped: songs.length };
  }

  const db = await getDatabase();
  let fixed = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const song of songs) {
    if (idFilter && !idFilter.has(song.id)) continue;

    let patched = false;
    let nextContent = song.content;
    let nextTitle = song.title;
    let nextArtist = song.artist;
    let nextSongNumber = song.song_number;

    const working: Song = { ...song };

    for (const fixer of fixers) {
      if (!fixer.canFix(working)) continue;
      const patch = await Promise.resolve(fixer.apply(working));
      if (!patch) continue;

      if (patch.content !== undefined) {
        nextContent = patch.content;
        working.content = patch.content;
      }
      if (patch.title !== undefined) {
        nextTitle = patch.title;
        working.title = patch.title;
      }
      if (patch.artist !== undefined) {
        nextArtist = patch.artist;
        working.artist = patch.artist;
      }
      if (patch.song_number !== undefined) {
        nextSongNumber = patch.song_number;
        working.song_number = patch.song_number;
      }
      patched = true;
    }

    if (!patched) {
      skipped += 1;
      continue;
    }

    const doc = await db.songs.findOne(song.id).exec();
    if (!doc || doc.isDeleted) {
      skipped += 1;
      continue;
    }

    await doc.patch({
      content: nextContent,
      title: nextTitle,
      artist: nextArtist,
      song_number: nextSongNumber,
      updatedAt: now,
      _deleted: false,
    });
    fixed += 1;
  }

  return { fixed, skipped };
}
