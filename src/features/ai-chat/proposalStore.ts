/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServiceElement } from "@/src/types";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Pending AI proposals live here — not in a mounted page — so they survive
 * navigation. A proposal for a song stays reviewable from the chat tray
 * (library, services, anywhere) and also shows up inside that song's editor
 * the moment it is opened.
 */

export type SongProposal = {
  kind: "song";
  /** `song:<id>` */
  key: string;
  entityId: string;
  content: string;
  title?: string;
  artist?: string;
  /** Tool that produced it. */
  source?: string;
  createdAt: number;
};

export type ServiceProposal = {
  kind: "service";
  key: string;
  entityId: string;
  elements: ServiceElement[];
  name?: string;
  notes?: string;
  source?: string;
  createdAt: number;
};

export type AiProposal = SongProposal | ServiceProposal;

const STORAGE_KEY = "hosanna:ai-proposals:v1";
const OUTCOMES_KEY = "hosanna:ai-proposal-outcomes:v1";
const MAX_OUTCOMES = 200;

export type ProposalOutcome = "accepted" | "declined";
/** What a proposal shown in the chat is doing right now. */
export type ProposalStatus = "pending" | ProposalOutcome | "stale";
const MAX_PROPOSALS = 50;

const songKey = (id: string) => `song:${id}`;
const serviceKey = (id: string) => `service:${id}`;

function load(): AiProposal[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is AiProposal =>
        !!p &&
        typeof p === "object" &&
        typeof (p as AiProposal).key === "string" &&
        typeof (p as AiProposal).entityId === "string" &&
        ((p as AiProposal).kind === "song" ||
          (p as AiProposal).kind === "service"),
    );
  } catch {
    return [];
  }
}

/** Cheap stable fingerprint of a proposal's content (djb2). */
function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function proposalFingerprint(key: string, content: string): string {
  return `${key}@${hashText(content)}`;
}

function contentOf(p: AiProposal): string {
  return p.kind === "song" ? p.content : JSON.stringify(p.elements);
}

function loadOutcomes(): Record<string, ProposalOutcome> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(OUTCOMES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, ProposalOutcome>)
      : {};
  } catch {
    return {};
  }
}

let proposals: AiProposal[] = load();
let outcomes: Record<string, ProposalOutcome> = loadOutcomes();
const listeners = new Set<() => void>();

function commit(next: AiProposal[]) {
  proposals = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / unavailable — in-memory state is still correct.
  }
  listeners.forEach((fn) => fn());
}

function recordOutcomes(list: AiProposal[], outcome: ProposalOutcome) {
  if (list.length === 0) return;
  const next = { ...outcomes };
  for (const p of list) {
    next[proposalFingerprint(p.key, contentOf(p))] = outcome;
  }
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_OUTCOMES))) {
    delete next[k];
  }
  outcomes = next;
  try {
    sessionStorage.setItem(OUTCOMES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function upsert(p: AiProposal) {
  const rest = proposals.filter((x) => x.key !== p.key);
  // Newest first; a newer proposal for the same entity replaces the old one.
  commit([p, ...rest].slice(0, MAX_PROPOSALS));
}

export const aiProposals = {
  getAll: () => proposals,

  stageSong(input: {
    songId: string;
    content: string;
    title?: string;
    artist?: string;
    source?: string;
  }) {
    upsert({
      kind: "song",
      key: songKey(input.songId),
      entityId: input.songId,
      content: input.content,
      title: input.title,
      artist: input.artist,
      source: input.source,
      createdAt: Date.now(),
    });
  },

  stageService(input: {
    serviceId: string;
    elements: ServiceElement[];
    name?: string;
    notes?: string;
    source?: string;
  }) {
    upsert({
      kind: "service",
      key: serviceKey(input.serviceId),
      entityId: input.serviceId,
      elements: input.elements,
      name: input.name,
      notes: input.notes,
      source: input.source,
      createdAt: Date.now(),
    });
  },

  /** Remove a proposal, remembering how it ended (shown in the chat). */
  resolve(key: string, outcome: ProposalOutcome = "declined") {
    const found = proposals.find((p) => p.key === key);
    if (!found) return;
    recordOutcomes([found], outcome);
    commit(proposals.filter((p) => p.key !== key));
  },

  resolveAll(keys?: string[], outcome: ProposalOutcome = "declined") {
    const targets = keys
      ? proposals.filter((p) => keys.includes(p.key))
      : proposals;
    recordOutcomes(targets, outcome);
    const set = new Set(targets.map((p) => p.key));
    commit(proposals.filter((p) => !set.has(p.key)));
  },

  /** Status of a proposal as it appears in a chat message. */
  statusOf(key: string, content: string): ProposalStatus {
    const live = proposals.find((p) => p.key === key);
    if (live && contentOf(live) === content) return "pending";
    return outcomes[proposalFingerprint(key, content)] ?? "stale";
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** All pending proposals, newest first. */
export function useAiProposals(): AiProposal[] {
  return useSyncExternalStore(
    aiProposals.subscribe,
    aiProposals.getAll,
    aiProposals.getAll,
  );
}

/** The pending proposal for one song, if any. */
export function useSongProposal(
  songId: string | null | undefined,
): SongProposal | null {
  const getSnapshot = useCallback(
    () =>
      (songId
        ? proposals.find((p) => p.key === songKey(songId))
        : undefined) as SongProposal | undefined,
    [songId],
  );
  return (
    useSyncExternalStore(aiProposals.subscribe, getSnapshot, getSnapshot) ??
    null
  );
}

export function useServiceProposal(
  serviceId: string | null | undefined,
): ServiceProposal | null {
  const getSnapshot = useCallback(
    () =>
      (serviceId
        ? proposals.find((p) => p.key === serviceKey(serviceId))
        : undefined) as ServiceProposal | undefined,
    [serviceId],
  );
  return (
    useSyncExternalStore(aiProposals.subscribe, getSnapshot, getSnapshot) ??
    null
  );
}

/** Pending / accepted / declined / stale for one song proposal in the chat. */
export function useSongProposalStatus(
  songId: string,
  content: string,
): ProposalStatus {
  const getSnapshot = useCallback(
    () => aiProposals.statusOf(songKey(songId), content),
    [songId, content],
  );
  return useSyncExternalStore(aiProposals.subscribe, getSnapshot, getSnapshot);
}
