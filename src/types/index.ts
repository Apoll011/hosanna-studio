/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string;
  orgId?: string;
  title: string;
  artist: string;
  song_number?: number | null;
  content: string; // ChordPro text format
  folderId?: string | null;
  path: string; // e.g., "Hymns/Amazing Grace.pro" or "Amazing Grace.pro"
  tags: string[];
  createdAt?: string;
  updatedAt: string;
  deleted?: boolean;
  purgeAt?: string | null;
}

export interface ParsedSong extends Song {
  folder: string; // e.g. "Worship" or "" (root)
  fileName: string; // e.g. "Digno_es_Tu.chopro"
  metadata: {
    title?: string;
    subtitle?: string;
    artist?: string;
    composer?: string;
    lyricist?: string;
    translator?: string;
    year?: string;
    copyright?: string;
    album?: string;
    key?: string;
    originalKey?: string;
    tempo?: string;
    time?: string;
    capo?: string;
    songNumber?: string;
    youtube?: string;
    ccli?: string;
    duration?: string;
    [key: string]: string | undefined;
  };
}

export interface SearchableSong {
  id: string;
  title: string;
  subtitle?: string;
  artist: string;
  content: string;
  composer?: string;
  year?: number;
  lyricist?: string;
  number?: number;
  path: string; // e.g., "Hymns/Amazing Grace.pro" or "Amazing Grace.pro"
  tags: string[];
  folder: string; // e.g. "Worship" or "" (root)
  album?: string;
  key?: string;
  originalKey?: string;
  tempo?: number;
  time?: string;
  capo?: string;
  ccli?: string;
  duration?: number;
  youtube?: string;
}

export interface SongsResponse {
  songs: Song[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Folder {
  id: string;
  orgId?: string;
  name: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  songCount?: number | null;
  folderCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  purgeAt?: string | null;
}

export interface FoldersResponse {
  folders: Folder[];
  rootSongsCount: number;
}

export interface ServiceElement {
  id: string;
  type:
    "welcome" | "scripture" | "message" | "announcement" | "custom" | "song";
  title: string;
  content?: string;
  position?: number;
  songId?: string;
  notes?: string;
  passage?: string;
  duration?: number;
}

export interface Service {
  id: string;
  orgId?: string;
  name: string;
  date: string;
  archived: boolean;
  notes?: string | null; // Service-wide planning notes
  elements?: ServiceElement[];
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  purgeAt?: string | null;
}

/**
 * A responsibility category ("Líder do Culto", "Som", "Projeção"...) that can
 * be assigned to agenda events. The master list lives in the org metadata
 * (`metadata.settings.agenda.responsibilityCategories`, see
 * `useOrgSettings`) so it's shared between the Agenda page and the Settings →
 * General "Responsabilidades" card — not per-user local storage.
 */
export type ResponsibilityColor =
  "amber" | "violet" | "sky" | "rose" | "emerald" | "cyan" | "slate" | "indigo";

/** Icon key — mapped to an actual lucide-react component in `agenda/iconMap.ts`. */
export type ResponsibilityIconKey =
  | "mic"
  | "music"
  | "volume"
  | "light"
  | "monitor"
  | "book"
  | "heart"
  | "users"
  | "camera"
  | "custom";

export interface ResponsibilityCategory {
  id: string;
  label: string;
  icon: ResponsibilityIconKey;
  color: ResponsibilityColor;
}

export interface Assignee {
  id: string;
  name: string;
  memberId?: string;
  avatarUrl?: string | null;
}

export interface Responsibility {
  id: string;
  categoryId: string;
  assignees: Assignee[];
}

export interface ReminderSettings {
  enabled: boolean;
  label: string;
}

export interface AgendaEvent {
  id: string;
  date: string;
  title: string;
  type: string;
  time: string;
  durationMinutes: number;
  location?: string | null;
  notes?: string | null;
  reminder: ReminderSettings;
  linkedServiceId?: string | null;
  responsibilities: Responsibility[];
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  purgeAt?: string | null;
}

export interface SyncStatusResponse {
  versionHash: string;
  timestamp: string;
  timestamps: {
    songs: string;
    folders: string;
    services: string;
  };
}

export interface GetSongsParams {
  search?: string;
  folder?: string;
  sortBy?: "title" | "artist" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  key?: string;
  tag?: string;
  searchFields?: {
    title: boolean;
    artist: boolean;
    content: boolean;
    tags: boolean;
  };
}

export interface FolderNode {
  name: string;
  path: string;
  type: "folder" | "song";
  children?: FolderNode[];
  songId?: string;
}

export type SyncStatus =
  "synced" | "syncing" | "error" | "offline" | "local_only";

export interface CifraResult {
  url: string;
  name?: string;
  artist?: string;
  youtube_url?: string;
  cifra?: string;
  error?: string;
}
