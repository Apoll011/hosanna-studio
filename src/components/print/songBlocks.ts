/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LineAST, SongAST } from "@hosanna/chordpro";

export type SongBlockKind =
  | "verse"
  | "chorus"
  | "bridge"
  | "tab"
  | "grid"
  | "comment"
  | "ref"
  | "divider";

export interface SongBlock {
  kind: SongBlockKind;
  label?: string;
  repeat?: string;
  lines: LineAST[];
  /** A plain stanza that hymn-style templates number automatically. */
  numbered?: boolean;
}

const CHORUS_LABEL = /^(coro|refr[ãa]o|chorus|refrain|estribillo|pre-?coro)/i;
const BRIDGE_LABEL = /^(ponte|bridge|puente)/i;
const VERSE_LABEL =
  /^((verse|verso|estrofe|estrofa|stanza|v)\.?\s*\d*\.?|\d+\.?)$/i;

const isLabelLine = (line: LineAST) =>
  line.type === "comment" || line.type === "comment_italic";

const hasContent = (line: LineAST) => {
  if (line.type === "empty") return false;
  if (line.type === "lyrics") {
    return (line.segments ?? []).some((s) => s.text.trim() || s.chord);
  }
  return true;
};

/** Splits a line list into stanzas at blank lines, dropping the blanks. */
function splitStanzas(lines: LineAST[]): LineAST[][] {
  const stanzas: LineAST[][] = [];
  let current: LineAST[] = [];
  for (const line of lines) {
    if (hasContent(line)) {
      current.push(line);
    } else if (current.length) {
      stanzas.push(current);
      current = [];
    }
  }
  if (current.length) stanzas.push(current);
  return stanzas;
}

/** Drops leading/trailing blanks and collapses runs of blanks into one gap. */
function tidyLines(lines: LineAST[]): LineAST[] {
  const out: LineAST[] = [];
  for (const line of lines) {
    if (hasContent(line)) out.push(line);
    else if (out.length && out[out.length - 1].type !== "empty") {
      out.push({ type: "empty" });
    }
  }
  while (out.length && out[out.length - 1].type === "empty") out.pop();
  return out;
}

function kindFromLabel(label?: string): "verse" | "chorus" | "bridge" {
  if (!label) return "verse";
  if (CHORUS_LABEL.test(label.trim())) return "chorus";
  if (BRIDGE_LABEL.test(label.trim())) return "bridge";
  return "verse";
}

/**
 * Normalises the parsed song into print blocks. The parser keeps everything
 * between explicit directives in one section, so `{c: Coro}`-style labels and
 * blank-line separated stanzas are recovered here.
 */
export function buildSongBlocks(
  song: SongAST,
  { showChords }: { showChords: boolean },
): SongBlock[] {
  const blocks: SongBlock[] = [];
  let pendingLabel: string | undefined;

  const takeLabel = () => {
    const label = pendingLabel;
    pendingLabel = undefined;
    return label;
  };
  const flushPending = () => {
    if (pendingLabel) {
      blocks.push({
        kind: "comment",
        lines: [{ type: "comment", text: pendingLabel }],
      });
      pendingLabel = undefined;
    }
  };
  const stripChordLines = (lines: LineAST[]) =>
    showChords ? lines : lines.filter((l) => l.type !== "chord-section");

  for (const section of song.sections) {
    switch (section.type) {
      case "new_song":
        flushPending();
        blocks.push({ kind: "divider", lines: [] });
        break;

      case "tab":
      case "grid":
        flushPending();
        if (showChords && section.lines.some(hasContent)) {
          blocks.push({
            kind: section.type,
            label: section.label,
            repeat: section.repeat,
            lines: tidyLines(section.lines),
          });
        }
        break;

      case "comment": {
        const comments = section.lines.filter(hasContent);
        flushPending();
        if (comments.length === 1 && comments[0].text) {
          pendingLabel = comments[0].text.trim();
        } else if (comments.length) {
          blocks.push({ kind: "comment", lines: comments });
        }
        break;
      }

      case "chorus":
      case "bridge": {
        const lines = tidyLines(stripChordLines(section.lines));
        const label = takeLabel() || section.label;
        blocks.push({
          kind: lines.length ? section.type : "ref",
          label,
          repeat: section.repeat,
          lines,
        });
        break;
      }

      default: {
        for (const stanza of splitStanzas(stripChordLines(section.lines))) {
          let lines = stanza;
          let label = section.label;

          if (!label && isLabelLine(lines[0])) {
            if (lines.length === 1) {
              flushPending();
              pendingLabel = lines[0].text?.trim();
              continue;
            }
            label = lines[0].text?.trim();
            lines = lines.slice(1);
          }
          if (!label) label = takeLabel();
          flushPending();

          const kind = kindFromLabel(label);
          blocks.push({
            kind,
            label,
            repeat: section.repeat,
            lines,
            numbered:
              kind === "verse" && (!label || VERSE_LABEL.test(label.trim())),
          });
        }
      }
    }
  }
  flushPending();

  return blocks;
}
