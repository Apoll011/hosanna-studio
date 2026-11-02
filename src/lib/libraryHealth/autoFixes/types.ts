/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SongScore } from "@hosanna/chordpro";
import type { Song } from "../../../types";

export type ScoreMissingCriterion = SongScore["missing"][number];

export type LibraryHealthAutoFixPatch = Partial<
  Pick<Song, "content" | "title" | "artist" | "song_number">
>;

/**
 * One auto-fix strategy for a library-health criterion.
 * Add new fixers here as more criteria become mechanically solvable.
 *
 * `canFix` stays sync so the health UI can mark rows without network I/O.
 * `apply` may be async (e.g. YouTube duration lookup).
 */
export interface LibraryHealthAutoFix {
  /** Stable id for logging / UI keys. */
  id: string;
  /** Score criterion this fix addresses. */
  criterion: ScoreMissingCriterion;
  /** True when this fixer can improve the song right now. */
  canFix(song: Song): boolean;
  /**
   * Build a partial song update. Return `null` if nothing changed.
   * Prefer content / metadata patches only — path is left alone.
   */
  apply(
    song: Song,
  ):
    | LibraryHealthAutoFixPatch
    | null
    | Promise<LibraryHealthAutoFixPatch | null>;
}
