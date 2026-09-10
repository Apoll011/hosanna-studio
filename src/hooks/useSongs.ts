/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseSong } from "@/src/api/songs";
import { useI18n } from "@/src/lib/i18n";
import { Folder, GetSongsParams, SearchableSong, Song } from "@/src/types";
import { parsedSongToSearchableSong } from "@/src/utils";
import { parseChordPro } from "@hosanna/chordpro";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "../contexts/SyncContext";
import {
  getDatabase,
  getPurgeAt,
  validateBatchSongs,
  validateSongMove,
  validateSongRules,
} from "../db";

function useSongMutations() {
  const { showToast } = useSync();
  const { t } = useI18n();
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingBatchTags, setIsUpdatingBatchTags] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const createSong = useCallback(
    async (data: Partial<Song>) => {
      setIsCreating(true);
      try {
        const db = await getDatabase();
        const now = new Date().toISOString();
        const id = data.id || crypto.randomUUID();
        const title = (data.title || t("forms.untitled")).trim();
        const folderId = data.folderId ?? null;

        // Enforce Prisma schema rules & unique index @@unique([orgId, path]) locally
        const { path } = await validateSongRules(db, {
          id,
          title,
          folderId,
          path: data.path,
        });

        const newSong = {
          id,
          title,
          artist: data.artist || "",
          content: data.content || "",
          folderId,
          path,
          tags: Array.isArray(data.tags) ? data.tags : [],
          song_number: data.song_number ?? null,
          createdAt: data.createdAt || now,
          updatedAt: now,
          _deleted: false,
        };

        const doc = await db.songs.insert(newSong);
        const result = doc.toJSON() as Song;
        showToast(t("hooks.songs.created"), "success");
        return result;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(
            msg ||
              t("hooks.songs.saveError", {
                error: "",
              }),
            "error",
          );
        }
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast, t],
  );

  const updateSong = useCallback(
    async (songUpdate: { id: string; data?: Partial<Song> } | Song) => {
      setIsUpdating(true);
      try {
        const db = await getDatabase();
        const id =
          "id" in songUpdate && "data" in songUpdate
            ? songUpdate.id
            : (songUpdate as Song).id;
        const data =
          "data" in songUpdate
            ? (songUpdate as { data: Partial<Song> }).data
            : (songUpdate as Song);

        const doc = await db.songs.findOne(id).exec();
        const now = new Date().toISOString();

        if (doc) {
          const nextTitle =
            data.title !== undefined ? data.title.trim() : doc.title;
          const nextFolderId =
            data.folderId !== undefined
              ? (data.folderId ?? null)
              : doc.folderId;
          const explicitPath = data.path !== undefined ? data.path : undefined;

          let newPath = doc.path;
          if (
            data.title !== undefined ||
            data.folderId !== undefined ||
            data.path !== undefined
          ) {
            const validated = await validateSongRules(
              db,
              {
                id,
                title: nextTitle,
                folderId: nextFolderId,
                path: explicitPath,
              },
              { existingId: id },
            );
            newPath = validated.path;
          }

          await doc.patch({
            ...data,
            title: nextTitle,
            folderId: nextFolderId,
            path: newPath,
            updatedAt: now,
            _deleted: false,
          });
          const updated = doc.toJSON() as Song;
          showToast(t("hooks.songs.updated"), "success");
          return updated;
        } else {
          const title = (data.title || t("forms.untitled")).trim();
          const folderId = data.folderId ?? null;
          const { path } = await validateSongRules(
            db,
            {
              id,
              title,
              folderId,
              path: data.path,
            },
            { existingId: id },
          );

          // If not existing locally yet, upsert
          const newDoc = await db.songs.upsert({
            id,
            title,
            artist: data.artist || "",
            content: data.content || "",
            folderId,
            path,
            tags: data.tags || [],
            song_number: data.song_number ?? null,
            createdAt: data.createdAt || now,
            updatedAt: now,
            _deleted: false,
            ...data,
          });
          const result = newDoc.toJSON() as Song;
          showToast(t("hooks.songs.updated"), "success");
          return result;
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(
            msg ||
              t("hooks.songs.saveError", {
                error: "",
              }),
            "error",
          );
        }
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, t],
  );

  const deleteSong = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      try {
        const db = await getDatabase();
        const doc = await db.songs.findOne(id).exec();
        if (doc) {
          // Move to trash; permanent removal happens at purgeAt via the trash verifier
          await doc.patch({
            isDeleted: true,
            purgeAt: getPurgeAt(),
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("hooks.songs.deleted"), "info");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.songs.deleteError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [showToast, t],
  );

  const restoreSong = useCallback(
    async (id: string) => {
      setIsRestoring(true);
      try {
        const db = await getDatabase();
        const doc = await db.songs.findOne(id).exec();
        if (doc) {
          await doc.patch({
            isDeleted: false,
            purgeAt: null,
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("trashPage.restore"), "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.songs.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsRestoring(false);
      }
    },
    [showToast, t],
  );

  const moveSong = useCallback(
    async ({
      id,
      folderId,
      newPath,
    }: {
      id: string;
      folderId: string | null;
      updatedAt?: string;
      newPath?: string;
    }) => {
      setIsUpdating(true);
      try {
        const db = await getDatabase();
        const { songDoc, newPath: computedPath } = await validateSongMove(
          db,
          id,
          folderId,
          newPath,
        );
        const now = new Date().toISOString();
        await songDoc.patch({
          folderId: folderId ?? null,
          path: computedPath,
          updatedAt: now,
        });
        showToast(t("hooks.songs.moved"), "success");
        return songDoc.toJSON() as Song;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(
            msg ||
              t("hooks.songs.saveError", {
                error: "",
              }),
            "error",
          );
        }
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, t],
  );

  const updateBatchTags = useCallback(
    async (params: {
      songIds: string[];
      tags: string[];
      mode?: "append" | "replace" | "remove";
    }) => {
      setIsUpdatingBatchTags(true);
      try {
        const db = await getDatabase();
        const mode = params.mode || "replace";
        const now = new Date().toISOString();

        let count = 0;
        for (const id of params.songIds) {
          const doc = await db.songs.findOne(id).exec();
          if (doc) {
            let nextTags = [...(doc.tags || [])];
            if (mode === "replace") {
              nextTags = [...params.tags];
            } else if (mode === "append") {
              const set = new Set([...nextTags, ...params.tags]);
              nextTags = Array.from(set);
            } else if (mode === "remove") {
              const toRemove = new Set(params.tags);
              nextTags = nextTags.filter((t) => !toRemove.has(t));
            }
            await doc.patch({
              tags: nextTags,
              updatedAt: now,
            });
            count++;
          }
        }

        showToast(t("songsPage.movedToast", { count }), "success");
        return { count };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.songs.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsUpdatingBatchTags(false);
      }
    },
    [showToast, t],
  );

  const batchCreateSongs = useCallback(
    async (items: Array<Partial<Song>>) => {
      setIsCreating(true);
      try {
        const db = await getDatabase();
        const prepared = await validateBatchSongs(
          db,
          items.map((i) => ({
            ...i,
            title: i.title || t("forms.untitled"),
          })),
        );
        await db.songs.bulkInsert(prepared as any);
        showToast(
          t("songsPage.movedToast", { count: prepared.length }),
          "success",
        );
        return prepared;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(
            msg ||
              t("hooks.songs.saveError", {
                error: "",
              }),
            "error",
          );
        }
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast, t],
  );

  return {
    createSong,
    batchCreateSongs,
    updateSong,
    deleteSong,
    restoreSong,
    moveSong,
    updateBatchTags,
    isCreating,
    isUpdating,
    isDeleting,
    isUpdatingBatchTags,
    isRestoring,
  };
}

let cachedSongsByFolder: Map<string, Song[]> = new Map();
let cachedAllSongs: Song[] | null = null;
let cachedSingleSongs: Map<string, Song> = new Map();

export function useSongs(params: GetSongsParams = {}) {
  const folder = params.folder;
  const folderKey =
    folder === undefined ? "__all__" : folder === null ? "__root__" : folder;

  const [songs, setSongs] = useState<Song[]>(() => {
    if (folderKey === "__all__" && cachedAllSongs) {
      let items = cachedAllSongs;
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (s) =>
            s.title?.toLowerCase().includes(q) ||
            s.artist?.toLowerCase().includes(q) ||
            s.content?.toLowerCase().includes(q) ||
            s.tags?.some((t) => t.toLowerCase().includes(q)),
        );
      }
      return items;
    }
    const cached = cachedSongsByFolder.get(folderKey);
    if (cached) {
      let items = cached;
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (s) =>
            s.title?.toLowerCase().includes(q) ||
            s.artist?.toLowerCase().includes(q) ||
            s.content?.toLowerCase().includes(q) ||
            s.tags?.some((t) => t.toLowerCase().includes(q)),
        );
      }
      return items;
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (folderKey === "__all__") return cachedAllSongs === null;
    return !cachedSongsByFolder.has(folderKey);
  });
  const mutations = useSongMutations();

  useEffect(() => {
    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeSongs() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        let query = db.songs.find({
          selector: {
            isDeleted: {
              $ne: true,
            },
          },
        });

        if (folder !== undefined) {
          query = db.songs.find({
            selector: {
              isDeleted: { $ne: true },
              folderId: folder,
            },
          });
        }

        rxSub = query.$.subscribe((docs) => {
          if (!isSubscribed) return;
          const rawItems = docs.map((d) => d.toJSON() as Song);

          if (folderKey === "__all__") {
            cachedAllSongs = rawItems;
          }
          cachedSongsByFolder.set(folderKey, rawItems);
          for (const s of rawItems) {
            cachedSingleSongs.set(s.id, s);
          }

          let items = rawItems;
          if (params.search) {
            const q = params.search.toLowerCase();
            items = items.filter(
              (s) =>
                s.title?.toLowerCase().includes(q) ||
                s.artist?.toLowerCase().includes(q) ||
                s.content?.toLowerCase().includes(q) ||
                s.tags?.some((t) => t.toLowerCase().includes(q)),
            );
          }

          setSongs(items);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to query songs from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeSongs();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [folder, folderKey, params.search]);

  const songsQuery = {
    data: {
      songs,
      total: songs.length,
      page: 1,
      totalPages: 1,
    },
    isLoading,
    isPending: isLoading,
    isError: false,
    error: null,
    refetch: async () => {},
  };

  return { songsQuery, ...mutations };
}

export function useAllSongs(params: GetSongsParams = {}) {
  return useSongs(params);
}

export function useSong(id: string | null) {
  const [song, setSong] = useState<Song | null>(() =>
    id ? (cachedSingleSongs.get(id) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(() =>
    id ? !cachedSingleSongs.has(id) : false,
  );

  useEffect(() => {
    if (!id) {
      setSong(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeSong() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSub = db.songs.findOne(id as string).$.subscribe((doc) => {
          if (!isSubscribed) return;
          if (doc && !doc.isDeleted) {
            const data = doc.toJSON() as Song;
            cachedSingleSongs.set(id as string, data);
            setSong(data);
          } else {
            cachedSingleSongs.delete(id as string);
            setSong(null);
          }
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to find song in RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeSong();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [id]);

  return {
    data: song,
    isLoading,
    isPending: isLoading,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}

let cachedSearchableSongs: SearchableSong[] | null = null;
let lastSearchableRawHash: string = "";

/**
 * Retrieves all songs converted into SerchableSong (SearchableSong) format,
 * reactive to RxDB database changes with memoized conversion for blazing fast performance.
 */
export function useSearchableSongs(folders: Folder[] = []) {
  const [searchableSongs, setSearchableSongs] = useState<SearchableSong[]>(
    () => cachedSearchableSongs ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    () => cachedSearchableSongs === null,
  );

  useEffect(() => {
    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribe() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        const query = db.songs.find({
          selector: {
            isDeleted: { $ne: true },
          },
        });

        rxSub = query.$.subscribe((docs) => {
          if (!isSubscribed) return;
          const rawItems = docs.map((d) => d.toJSON() as Song);

          // Fast check if items changed based on IDs and update timestamps
          const currentHash = rawItems
            .map((s) => `${s.id}:${s.updatedAt}`)
            .join("|");
          if (cachedSearchableSongs && currentHash === lastSearchableRawHash) {
            setSearchableSongs(cachedSearchableSongs);
            setIsLoading(false);
            return;
          }

          const converted = rawItems.map((song) => {
            const parsed = parseSong(song, folders);
            const lyricsOnly = parseChordPro(parsed.content || "").removeChords(
              true,
            );
            return parsedSongToSearchableSong({
              ...parsed,
              content: lyricsOnly.sections
                .flatMap((section) =>
                  section.lines.map(
                    (line) =>
                      line.segments?.map((segment) => segment.text).join("") ??
                      line.text ??
                      "",
                  ),
                )
                .join("\n"),
            });
          });

          cachedSearchableSongs = converted;
          lastSearchableRawHash = currentHash;
          setSearchableSongs(converted);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to query searchable songs from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribe();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [folders]);

  return {
    searchableSongs,
    isLoading,
  };
}
