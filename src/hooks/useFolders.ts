/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Folder } from "@/src/types";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "../contexts/SyncContext";
import {
  computeFolderSongPaths,
  computeSongPath,
  getDatabase,
  getPurgeAt,
  updateFolderCounts,
  validateFolderRename,
  validateFolderRules,
} from "../db";

let cachedFolders: Folder[] | null = null;
let cachedRootSongsCount: number = 0;

export function useFolders() {
  const { showToast } = useSync();
  const [folders, setFolders] = useState<Folder[]>(() => cachedFolders ?? []);
  const [rootSongsCount, setRootSongsCount] = useState<number>(
    () => cachedRootSongsCount,
  );
  const [isLoading, setIsLoading] = useState(() => cachedFolders === null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    let rxSubFolders: { unsubscribe: () => void } | null = null;
    let rxSubSongs: { unsubscribe: () => void } | null = null;

    async function subscribeData() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSubFolders = db.folders
          .find({
            selector: {
              isDeleted: {
                $ne: true,
              },
            },
          })
          .$.subscribe((docs) => {
            if (!isSubscribed) return;
            const data = docs.map((d) => d.toJSON() as Folder);
            cachedFolders = data;
            setFolders(data);
            setIsLoading(false);
          });

        rxSubSongs = db.songs
          .find({
            selector: {
              isDeleted: { $ne: true },
              folderId: null,
            },
          })
          .$.subscribe((docs) => {
            if (!isSubscribed) return;
            cachedRootSongsCount = docs.length;
            setRootSongsCount(docs.length);
          });
      } catch (err) {
        console.error("Failed to query folders from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeData();

    return () => {
      isSubscribed = false;
      if (rxSubFolders) rxSubFolders.unsubscribe();
      if (rxSubSongs) rxSubSongs.unsubscribe();
    };
  }, []);

  const createFolder = useCallback(
    async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      setIsCreating(true);
      try {
        const db = await getDatabase();
        const trimmedName = name.trim();
        const parent = parentId ?? null;

        // Enforce Prisma schema rules locally
        await validateFolderRules(db, { name: trimmedName, parentId: parent });

        const now = new Date().toISOString();
        const newFolder = {
          id: crypto.randomUUID(),
          name: trimmedName,
          parentId: parent,
          songCount: 0,
          folderCount: 0,
          createdAt: now,
          updatedAt: now,
          _deleted: false,
        };

        const doc = await db.folders.insert(newFolder);
        if (parent) {
          await updateFolderCounts(db, parent);
        }
        const result = doc.toJSON() as Folder;
        showToast(`Folder "${result.name}" created`, "success");
        return result;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            (err as Error).message || "Failed to create folder",
            "error",
          );
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast],
  );

  const renameFolder = useCallback(
    async ({ id, name }: { id: string; name: string; updatedAt?: string }) => {
      setIsRenaming(true);
      try {
        const db = await getDatabase();
        const { folderDoc, songsToUpdate } = await validateFolderRename(
          db,
          id,
          name,
        );

        const now = new Date().toISOString();
        await folderDoc.patch({
          name: name.trim(),
          updatedAt: now,
        });

        // Cascade path updates to all child songs in local RxDB matching server behavior
        for (const { doc, newPath } of songsToUpdate) {
          await doc.patch({
            path: newPath,
            updatedAt: now,
          });
        }

        showToast("Folder renamed", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            (err as Error).message || "Failed to rename folder",
            "error",
          );
        throw err;
      } finally {
        setIsRenaming(false);
      }
    },
    [showToast],
  );

  const customizeFolder = useCallback(
    async ({
      id,
      color,
      icon,
    }: {
      id: string;
      color?: string;
      icon?: string;
      updatedAt?: string;
    }) => {
      try {
        const db = await getDatabase();
        const doc = await db.folders.findOne(id).exec();
        if (doc) {
          await doc.patch({
            ...(color !== undefined ? { color } : {}),
            ...(icon !== undefined ? { icon } : {}),
            updatedAt: new Date().toISOString(),
          });
        }
        showToast("Pasta personalizada com sucesso", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            (err as Error).message || "Falha ao personalizar pasta",
            "error",
          );
        throw err;
      }
    },
    [showToast],
  );

  const moveFolder = useCallback(
    async ({
      id,
      parentId,
    }: {
      id: string;
      parentId: string | null;
      updatedAt?: string;
    }) => {
      setIsMoving(true);
      try {
        const db = await getDatabase();
        await validateFolderRules(
          db,
          { id, parentId: parentId ?? null },
          { existingId: id },
        );

        const doc = await db.folders.findOne(id).exec();
        if (doc) {
          const oldParentId = doc.parentId ?? null;
          const targetParentId = parentId ?? null;
          const now = new Date().toISOString();
          await doc.patch({
            parentId: targetParentId,
            updatedAt: now,
          });

          // Recalculate song paths for songs inside the moved folder
          // (mirrors server behavior; no-op while paths only embed the
          // folder name, but repairs any stale paths in this folder)
          const songsToUpdate = await computeFolderSongPaths(db, id);
          for (const { doc: songDoc, newPath } of songsToUpdate) {
            await songDoc.patch({
              path: newPath,
              updatedAt: now,
            });
          }

          // Recalculate folder counts on affected source and destination parent folders
          if (oldParentId && oldParentId !== targetParentId) {
            await updateFolderCounts(db, oldParentId);
          }
          if (targetParentId && targetParentId !== oldParentId) {
            await updateFolderCounts(db, targetParentId);
          }
        }
        showToast("Folder moved", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast((err as Error).message || "Failed to move folder", "error");
        throw err;
      } finally {
        setIsMoving(false);
      }
    },
    [showToast],
  );

  const deleteFolder = useCallback(
    async ({
      id,
      action,
    }: {
      id: string;
      action: "delete_songs" | "move_to_root";
    }) => {
      setIsDeleting(true);
      try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        const purgeAt = getPurgeAt();

        // 1. Move folder to trash
        const folderDoc = await db.folders.findOne(id).exec();
        const parentId = folderDoc?.parentId ?? null;
        if (folderDoc) {
          await folderDoc.patch({
            isDeleted: true,
            purgeAt,
            updatedAt: now,
          });
        }

        // 2. Handle child songs
        const songsInFolder = await db.songs
          .find({
            selector: {
              folderId: id,
              isDeleted: { $ne: true },
            },
          })
          .exec();

        for (const songDoc of songsInFolder) {
          if (action === "delete_songs") {
            await songDoc.patch({
              isDeleted: true,
              purgeAt,
              updatedAt: now,
            });
          } else {
            // Move song to root: recalculate its path from the title so it
            // no longer references the deleted folder ("Title.pro")
            const newPath = await computeSongPath(db, songDoc.title, null);
            await songDoc.patch({
              folderId: null,
              path: newPath,
              updatedAt: now,
            });
          }
        }

        // 3. Handle subfolders recursively / move to root
        const subfolders = await db.folders
          .find({
            selector: {
              parentId: id,
              isDeleted: { $ne: true },
            },
          })
          .exec();

        for (const sub of subfolders) {
          await sub.patch({
            parentId: null,
            updatedAt: now,
          });
        }

        // Recalculate parent folder count
        if (parentId) {
          await updateFolderCounts(db, parentId);
        }

        showToast("Folder deleted", "info");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(err.message || "Failed to delete folder", "error");
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [showToast],
  );

  const restoreFolder = useCallback(
    async (id: string) => {
      setIsRestoring(true);
      try {
        const db = await getDatabase();
        const doc = await db.folders.findOne(id).exec();
        if (doc) {
          let targetParentId = doc.parentId ?? null;
          if (targetParentId) {
            const parent = await db.folders.findOne(targetParentId).exec();
            if (!parent || parent.isDeleted || parent._deleted) {
              targetParentId = null;
            }
          }

          await doc.patch({
            isDeleted: false,
            _deleted: false,
            purgeAt: null,
            parentId: targetParentId,
            updatedAt: new Date().toISOString(),
          });

          // Recalculate counts for the restored folder and its parent
          await updateFolderCounts(db, id);
          if (targetParentId) {
            await updateFolderCounts(db, targetParentId);
          }
        }
        showToast("Folder restored", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(err.message || "Failed to restore folder", "error");
        throw err;
      } finally {
        setIsRestoring(false);
      }
    },
    [showToast],
  );

  return {
    foldersQuery: {
      data: {
        folders,
        rootSongsCount,
      },
      isLoading,
      isPending: isLoading,
      isError: false,
      error: null,
      refetch: async () => {},
    },
    createFolder,
    renameFolder,
    customizeFolder,
    moveFolder,
    deleteFolder,
    restoreFolder,
    isCreating,
    isRenaming,
    isMoving,
    isDeleting,
    isRestoring,
  };
}
