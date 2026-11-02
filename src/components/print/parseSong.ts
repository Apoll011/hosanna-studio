/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseChordPro, SongAST } from "@hosanna/chordpro";

const MAX_CACHE = 400;
const cache = new Map<string, SongAST | null>();

/**
 * Parse ChordPro with a bounded LRU-ish cache so huge songbooks don't
 * re-parse the same content on every options tweak / remount.
 */
export function safeParseSong(
  content: string,
  cacheKey?: string,
): SongAST | null {
  const key = cacheKey ?? content;
  if (cache.has(key)) {
    const hit = cache.get(key) ?? null;
    // Refresh insertion order for a cheap LRU.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  let ast: SongAST | null = null;
  try {
    ast = parseChordPro(content || "");
  } catch {
    ast = null;
  }

  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, ast);
  return ast;
}
