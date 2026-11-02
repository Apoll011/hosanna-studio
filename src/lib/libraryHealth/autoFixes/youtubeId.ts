/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const VIDEO_ID_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
const BARE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Extract an 11-char YouTube video id from a URL or bare id. */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (BARE_ID_RE.test(trimmed)) return trimmed;
  const match = trimmed.match(VIDEO_ID_RE);
  return match?.[1] ?? null;
}
