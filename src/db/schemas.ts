/**
 * Hosana document type definitions.
 *
 * These are pure TypeScript interfaces — no RxDB schema objects.
 * The engine uses them for type-safety only; runtime validation is
 * handled by validateSongRules / validateFolderRules / etc. in validation.ts.
 */

import { ReminderSettings, Responsibility, ServiceElement } from "@/src/types";
import { SongScore } from "@hosanna/chordpro";

export interface SongDocType {
  id: string;
  title: string;
  artist: string;
  content: string;
  folderId?: string | null;
  collectionIds?: string[];
  path: string;
  tags: string[];
  score?: SongScore;
  song_number?: number | null;
  createdAt: string;
  updatedAt: string;
  _deleted?: boolean;
  isDeleted?: boolean;
  purgeAt?: string | null;
}

export interface CollectionDocType {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  image?: string | null;
  songCount?: number | null;
  songIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  _deleted?: boolean;
  isDeleted?: boolean;
  purgeAt?: string | null;
}

export interface FolderDocType {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  songCount?: number | null;
  folderCount?: number | null;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _deleted?: boolean;
  isDeleted?: boolean;
  purgeAt?: string | null;
}

export interface ServiceDocType {
  id: string;
  name: string;
  date: string;
  notes?: string | null;
  elements?: ServiceElement[];
  archived: boolean;
  createdAt?: string;
  updatedAt?: string;
  _deleted?: boolean;
  isDeleted?: boolean;
  purgeAt?: string | null;
}

/**
 * Wire/doc shape of an agenda event — mirrors the server's `agendaEvents`
 * replication collection (see the replication contract). The `reminder` and
 * `responsibilities` payloads are the same domain types used by the Agenda UI
 * (`@/src/types`), stored verbatim in jsonb columns on the server.
 *
 * Notes on the contract:
 * - `date` is a **local** "yyyy-mm-dd" string. It is never converted to/from
 *   UTC or timezone-shifted — treat it as an opaque local date.
 * - `time` is 24h "HH:mm" (no seconds, no timezone).
 * - `linkedServiceId` is a real FK to a `services` row on the server
 *   (`ON DELETE SET NULL`), so pushes must order `services` before
 *   `agendaEvents` (see `src/db/replication.ts`).
 * - `isDeleted`/`purgeAt` implement the shared trash semantics: soft-deleted
 *   rows keep being pulled (recoverable), hard purge is a server cron job.
 * - `_deleted` is the replication tombstone field and is always `false` on pull.
 */
export interface AgendaEventDocType {
  id: string;
  /** Local calendar date "yyyy-mm-dd" — never timezone-shifted. */
  date: string;
  title: string;
  /** Free-text event type, e.g. "Culto Dominical". */
  type: string;
  /** 24h start time "HH:mm". */
  time: string;
  durationMinutes: number;
  location?: string | null;
  notes?: string | null;
  /** Reminder settings — always present. */
  reminder: ReminderSettings;
  /** Optional FK to an order-of-worship `services` doc id. */
  linkedServiceId?: string | null;
  /** Responsibilities assigned to this event (may be []). */
  responsibilities: Responsibility[];
  createdAt?: string;
  updatedAt?: string; // conflict-detection field — keep verbatim from the server
  /** Trash flag — NOT the replication tombstone (see `_deleted`). */
  isDeleted?: boolean;
  /** Set while trashed; null when live or restored. */
  purgeAt?: string | null;
  /** Reserved replication tombstone. Always false on pull. */
  _deleted?: boolean;
}
