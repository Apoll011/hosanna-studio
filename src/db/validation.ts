/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Song } from "../types";
import type { HosanaDatabase } from "./database";
import type { HosanaDoc } from "./engine/collection";
import type { FolderDocType, ServiceDocType, SongDocType } from "./schemas";

// ─── Internal convenience type aliases ────────────────────────────────────────
// HosanaDatabase stores collections as HosanaCollection<DocType & Record<string,unknown>>.
// These aliases reflect what findOne/find actually return so callers get full typing.
type SongDoc = HosanaDoc<SongDocType & Record<string, unknown>>;
type FolderDoc = HosanaDoc<FolderDocType & Record<string, unknown>>;

export class SchemaValidationError extends Error {
  readonly code: string;
  constructor(message: string, code: string = "SCHEMA_VALIDATION_ERROR") {
    super(message);
    this.name = "SchemaValidationError";
    this.code = code;
  }
}

export class UniqueConstraintError extends SchemaValidationError {
  readonly fields: string[];
  readonly targetValue: string;

  constructor(
    message: string,
    fields: string[] = ["path"],
    targetValue: string = "",
  ) {
    super(message, "UNIQUE_CONSTRAINT_VIOLATION");
    this.name = "UniqueConstraintError";
    this.fields = fields;
    this.targetValue = targetValue;
  }
}

export class ForeignKeyError extends SchemaValidationError {
  readonly relation: string;
  readonly foreignId: string;

  constructor(message: string, relation: string, foreignId: string) {
    super(message, "FOREIGN_KEY_VIOLATION");
    this.name = "ForeignKeyError";
    this.relation = relation;
    this.foreignId = foreignId;
  }
}

export class HierarchyCycleError extends SchemaValidationError {
  constructor(message: string) {
    super(message, "HIERARCHY_CYCLE_DETECTED");
    this.name = "HierarchyCycleError";
  }
}

export class RequiredFieldError extends SchemaValidationError {
  readonly field: string;
  constructor(field: string, message?: string) {
    super(message || `Field "${field}" is required.`, "REQUIRED_FIELD_MISSING");
    this.name = "RequiredFieldError";
    this.field = field;
  }
}

/**
 * Computes song path based on title and folder hierarchy, mirroring Prisma server behavior:
 * - If explicitPath is provided, returns explicitPath.
 * - If folderId is provided, resolves folder and returns `${folder.name}/${title}.pro`.
 * - Otherwise (root), returns `${title}.pro`.
 *
 * Pass folderNameOverride when the folder is being renamed and its doc still has the
 * old name, so the path can be computed with the *new* folder name.
 */
export async function computeSongPath(
  db: HosanaDatabase,
  title: string,
  folderId: string | null | undefined,
  explicitPath?: string,
  folderNameOverride?: string,
): Promise<string> {
  const trimmedTitle = title.trim();
  if (explicitPath && explicitPath.trim().length > 0) {
    return explicitPath.trim();
  }

  if (!folderId) {
    return `${trimmedTitle}.pro`;
  }

  let folderName: string;
  if (folderNameOverride !== undefined) {
    folderName = folderNameOverride;
  } else {
    const folderDoc = await db.folders.findOne(folderId).exec();
    if (!folderDoc || folderDoc.isDeleted || folderDoc._deleted) {
      throw new ForeignKeyError(
        `Folder with ID "${folderId}" does not exist or has been deleted.`,
        "folder",
        folderId,
      );
    }
    folderName = folderDoc.name as string;
  }

  return `${folderName.trim()}/${trimmedTitle}.pro`;
}

/**
 * Recomputes the path of every active song inside a folder via computeSongPath.
 * Returns only the songs whose path actually changes, so callers can patch them.
 */
export async function computeFolderSongPaths(
  db: HosanaDatabase,
  folderId: string,
  options: { folderNameOverride?: string } = {},
): Promise<{ doc: SongDoc; newPath: string }[]> {
  const songsInFolder = await db.songs
    .find({
      selector: {
        folderId,
        isDeleted: { $ne: true },
        _deleted: { $ne: true },
      },
    })
    .exec();

  const songsToUpdate: { doc: SongDoc; newPath: string }[] = [];

  for (const songDoc of songsInFolder) {
    const newPath = await computeSongPath(
      db,
      songDoc.title as string,
      folderId,
      undefined,
      options.folderNameOverride,
    );
    if (newPath !== songDoc.path) {
      songsToUpdate.push({ doc: songDoc, newPath });
    }
  }

  return songsToUpdate;
}

/**
 * Validates a song against Prisma schema rules:
 * 1. Required fields: title (non-empty)
 * 2. Referential integrity: folderId references active Folder
 * 3. @@unique([orgId, path]): No other active song can share the same path
 */
export async function validateSongRules(
  db: HosanaDatabase,
  song: Partial<SongDocType> & { title: string },
  options: { existingId?: string } = {},
): Promise<{ path: string; folderId: string | null }> {
  const title = (song.title || "").trim();
  if (!title) {
    throw new RequiredFieldError("title", "Song title is required.");
  }

  const folderId = song.folderId ?? null;
  const computedPath = await computeSongPath(db, title, folderId, song.path);

  const targetId = options.existingId || song.id;
  const existingWithSamePath = await db.songs
    .find({
      selector: {
        isDeleted: { $ne: true },
        _deleted: { $ne: true },
        path: computedPath,
      },
    })
    .exec();

  const conflict = existingWithSamePath.find((doc) => doc.id !== targetId);
  if (conflict) {
    const inFolderMsg = folderId ? `in this folder` : `at the root level`;
    throw new UniqueConstraintError(
      `A song with this title already exists ${inFolderMsg} ("${computedPath}").`,
      ["orgId", "path"],
      computedPath,
    );
  }

  return { path: computedPath, folderId };
}

/**
 * Validates a folder against Prisma schema rules:
 * 1. Required fields: name (non-empty)
 * 2. Referential integrity: parentId references active Folder
 * 3. Hierarchy cycle / self-parent prevention
 */
export async function validateFolderRules(
  db: HosanaDatabase,
  folder: { id?: string; name?: string; parentId?: string | null },
  options: { existingId?: string } = {},
): Promise<void> {
  const name = (folder.name || "").trim();
  if (!name) {
    throw new RequiredFieldError("name", "Folder name is required.");
  }

  const folderId = options.existingId || folder.id;
  const parentId = folder.parentId ?? null;

  if (parentId) {
    if (folderId && parentId === folderId) {
      throw new HierarchyCycleError("A folder cannot be its own parent.");
    }

    const parentDoc = await db.folders.findOne(parentId).exec();
    if (!parentDoc || parentDoc.isDeleted || parentDoc._deleted) {
      throw new ForeignKeyError(
        `Parent folder with ID "${parentId}" does not exist or has been deleted.`,
        "parentFolder",
        parentId,
      );
    }

    if (folderId) {
      let currentParent: string | null =
        (parentDoc.parentId as string | null) ?? null;
      const visited = new Set<string>([parentId]);

      while (currentParent) {
        if (currentParent === folderId) {
          throw new HierarchyCycleError(
            "Cannot move folder: target destination is a subfolder of this folder.",
          );
        }
        if (visited.has(currentParent)) break;
        visited.add(currentParent);

        const nextDoc = await db.folders.findOne(currentParent).exec();
        currentParent = nextDoc
          ? ((nextDoc.parentId as string | null) ?? null)
          : null;
      }
    }
  }
}

/**
 * Validates renaming a folder:
 * - Checks folder name
 * - Computes new paths for all active child songs
 * - Ensures none of the child songs will collide with an existing song
 */
export async function validateFolderRename(
  db: HosanaDatabase,
  folderId: string,
  newName: string,
): Promise<{
  folderDoc: FolderDoc;
  songsToUpdate: { doc: SongDoc; newPath: string }[];
}> {
  const trimmedName = newName.trim();
  if (!trimmedName) {
    throw new RequiredFieldError("name", "Folder name is required.");
  }

  const folderDoc = await db.folders.findOne(folderId).exec();
  if (!folderDoc || folderDoc.isDeleted || folderDoc._deleted) {
    throw new ForeignKeyError(
      `Folder with ID "${folderId}" does not exist.`,
      "folder",
      folderId,
    );
  }

  const songsToUpdate = await computeFolderSongPaths(db, folderId, {
    folderNameOverride: trimmedName,
  });

  for (const { doc: songDoc, newPath } of songsToUpdate) {
    const existing = await db.songs
      .find({
        selector: {
          path: newPath,
          isDeleted: { $ne: true },
          _deleted: { $ne: true },
        },
      })
      .exec();

    const conflict = existing.find((d) => d.id !== songDoc.id);
    if (conflict) {
      throw new UniqueConstraintError(
        `Cannot rename folder: song "${songDoc.title as string}" would conflict with an existing song at "${newPath}".`,
        ["orgId", "path"],
        newPath,
      );
    }
  }

  return { folderDoc, songsToUpdate };
}

/**
 * Validates moving a song to a target folder:
 * - Ensures targetFolder exists (if not root)
 * - Computes new path
 * - Ensures path uniqueness
 */
export async function validateSongMove(
  db: HosanaDatabase,
  songId: string,
  targetFolderId: string | null,
  explicitPath?: string,
): Promise<{ songDoc: SongDoc; newPath: string }> {
  const songDoc = await db.songs.findOne(songId).exec();
  if (!songDoc || songDoc.isDeleted || songDoc._deleted) {
    throw new ForeignKeyError(
      `Song with ID "${songId}" does not exist.`,
      "song",
      songId,
    );
  }

  const newPath = await computeSongPath(
    db,
    songDoc.title as string,
    targetFolderId,
    explicitPath,
  );

  const existingWithSamePath = await db.songs
    .find({
      selector: {
        isDeleted: { $ne: true },
        _deleted: { $ne: true },
        path: newPath,
      },
    })
    .exec();

  const conflict = existingWithSamePath.find((d) => d.id !== songId);
  if (conflict) {
    const inFolderMsg = targetFolderId
      ? `in the destination folder`
      : `at the root level`;
    throw new UniqueConstraintError(
      `A song with the title "${songDoc.title as string}" already exists ${inFolderMsg} ("${newPath}").`,
      ["orgId", "path"],
      newPath,
    );
  }

  return { songDoc, newPath };
}

/**
 * Validates a service against Prisma schema rules:
 * 1. Required fields: name (non-empty)
 * 2. Valid date
 */
export function validateServiceRules(
  service: Partial<ServiceDocType> & { name?: string; date?: string | Date },
): void {
  const name = (service.name || "").trim();
  if (!name) {
    throw new RequiredFieldError("name", "Service title is required.");
  }

  if (service.date) {
    const timestamp = new Date(service.date).getTime();
    if (isNaN(timestamp)) {
      throw new SchemaValidationError("Invalid service date.", "INVALID_DATE");
    }
  }
}

/**
 * Validates an agenda event against the server's required fields.
 */
export function validateAgendaEventRules(event: {
  title?: string;
  date?: string;
  type?: string;
  time?: string;
  durationMinutes?: number;
}): void {
  if (!event.title || !event.title.trim()) {
    throw new RequiredFieldError("title", "Event title is required.");
  }

  if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    throw new SchemaValidationError(
      "Invalid event date. Expected a local yyyy-mm-dd string.",
      "INVALID_DATE",
    );
  }

  if (!event.type || !event.type.trim()) {
    throw new RequiredFieldError("type", "Event type is required.");
  }

  if (!event.time || !/^\d{2}:\d{2}$/.test(event.time)) {
    throw new SchemaValidationError(
      "Invalid event time. Expected HH:mm (24h).",
      "INVALID_TIME",
    );
  }

  if (
    typeof event.durationMinutes !== "number" ||
    isNaN(event.durationMinutes) ||
    event.durationMinutes < 0
  ) {
    throw new RequiredFieldError(
      "durationMinutes",
      "A valid event duration is required.",
    );
  }
}

/**
 * Validates a batch of songs before creation/import.
 */
export async function validateBatchSongs(
  db: HosanaDatabase,
  songsList: Array<Partial<SongDocType> & { title: string }>,
): Promise<Array<Song>> {
  const now = new Date().toISOString();
  const prepared: SongDocType[] = [];
  const seenPaths = new Set<string>();

  for (const item of songsList) {
    const title = (item.title || "").trim();
    if (!title) {
      throw new RequiredFieldError("title", "Song title is required.");
    }

    const folderId = item.folderId ?? null;
    const computedPath = await computeSongPath(db, title, folderId, item.path);

    if (seenPaths.has(computedPath)) {
      throw new UniqueConstraintError(
        `Duplicate song in batch with path: "${computedPath}".`,
        ["orgId", "path"],
        computedPath,
      );
    }
    seenPaths.add(computedPath);

    const existing = await db.songs
      .find({
        selector: {
          path: computedPath,
          isDeleted: { $ne: true },
          _deleted: { $ne: true },
        },
      })
      .exec();

    if (existing.length > 0) {
      throw new UniqueConstraintError(
        `A song with path "${computedPath}" already exists in the database.`,
        ["orgId", "path"],
        computedPath,
      );
    }

    prepared.push({
      id: item.id || crypto.randomUUID(),
      title,
      artist: item.artist || "",
      content: item.content || "",
      folderId,
      path: computedPath,
      tags: Array.isArray(item.tags) ? item.tags : [],
      song_number: item.song_number ?? null,
      createdAt: item.createdAt || now,
      updatedAt: now,
      _deleted: false,
    });
  }

  return prepared;
}
