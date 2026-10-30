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

let proposals: AiProposal[] = load();
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

  resolve(key: string) {
    if (!proposals.some((p) => p.key === key)) return;
    commit(proposals.filter((p) => p.key !== key));
  },

  resolveAll(keys?: string[]) {
    if (!keys) return commit([]);
    const set = new Set(keys);
    commit(proposals.filter((p) => !set.has(p.key)));
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
