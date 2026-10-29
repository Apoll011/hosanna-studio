/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Extract a ChordPro/song proposal payload from a tool result. */
export function extractSongProposal(output: unknown): {
  id?: string;
  content: string;
  title?: string;
  artist?: string;
  diffPreview?: string;
} | null {
  let parsed: unknown = output;
  if (typeof output === "string") {
    try {
      parsed = JSON.parse(output);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as {
    proposal?: {
      id?: string;
      content?: string;
      title?: string;
      artist?: string;
    };
    content?: string;
    diff?: { preview?: string };
  };
  // Only stage intentional proposals (not raw songs.get / parse payloads).
  const content = obj.proposal?.content;
  if (!content || typeof content !== "string") return null;
  return {
    id: obj.proposal?.id,
    content,
    title: obj.proposal?.title,
    artist: obj.proposal?.artist,
    diffPreview:
      typeof obj.diff?.preview === "string" ? obj.diff.preview : undefined,
  };
}

export function extractServiceProposal(output: unknown): {
  serviceId?: string;
  name?: string;
  notes?: string;
  elements: unknown[];
} | null {
  let parsed: unknown = output;
  if (typeof output === "string") {
    try {
      parsed = JSON.parse(output);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const proposal = (parsed as { proposal?: Record<string, unknown> }).proposal;
  if (!proposal?.elements || !Array.isArray(proposal.elements)) return null;
  return {
    serviceId: typeof proposal.id === "string" ? proposal.id : undefined,
    name: typeof proposal.name === "string" ? proposal.name : undefined,
    notes: typeof proposal.notes === "string" ? proposal.notes : undefined,
    elements: proposal.elements,
  };
}
