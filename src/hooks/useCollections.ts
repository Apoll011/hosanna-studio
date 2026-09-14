/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Collection, Song } from "@/src/types";
import { useCallback, useEffect, useState } from "react";
import { PrintOptions } from "../components/print/types";
import { usePrint } from "../contexts/PrintContext";
import { useSync } from "../contexts/SyncContext";
import {
  getDatabase,
  getPurgeAt,
  updateCollectionCounts,
  validateCollectionRules,
} from "../db";
import { invalidateSongsCache } from "./useSongs";

let cachedCollections: Collection[] | null = null;
let cachedSingleCollections: Map<string, Collection> = new Map();

export function invalidateCollectionsCache(): void {
  cachedCollections = null;
  cachedSingleCollections.clear();
}

export function useCollections() {
  const { showToast } = useSync();
  const [collections, setCollections] = useState<Collection[]>(
    () => cachedCollections ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => cachedCollections === null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeData() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSub = db.collections
          .find({
            selector: {
              isDeleted: {
                $ne: true,
              },
            },
          })
          .$.subscribe((docs) => {
            if (!isSubscribed) return;
            const data = docs.map((d) => d.toJSON() as Collection);
            cachedCollections = data;
            for (const c of data) {
              cachedSingleCollections.set(c.id, c);
            }
            setCollections(data);
            setIsLoading(false);
          });
      } catch (err) {
        console.error("Failed to query collections from database", err);
        setIsLoading(false);
      }
    }

    void subscribeData();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, []);

  const createCollection = useCallback(
    async ({
      name,
      description,
      color,
      icon,
      image,
      songIds,
    }: {
      name: string;
      description?: string | null;
      color?: string;
      icon?: string;
      image?: string | null;
      songIds?: string[];
    }) => {
      setIsCreating(true);
      try {
        const db = await getDatabase();
        const trimmedName = name.trim();

        await validateCollectionRules(db, { name: trimmedName });

        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const songsList = Array.isArray(songIds) ? songIds : [];

        const newCollection = {
          id,
          name: trimmedName,
          description: description ?? null,
          color: color || "default",
          icon: icon || "default",
          image: image ?? null,
          songCount: songsList.length,
          songIds: songsList,
          createdAt: now,
          updatedAt: now,
          _deleted: false,
        };

        const doc = await db.collections.insert(newCollection);

        // If songIds are provided, update each song's collectionIds
        if (songsList.length > 0) {
          for (const sId of songsList) {
            const songDoc = await db.songs.findOne(sId).exec();
            if (songDoc && !songDoc.isDeleted && !songDoc._deleted) {
              const currentIds: string[] = Array.isArray(songDoc.collectionIds)
                ? [...songDoc.collectionIds]
                : [];
              if (!currentIds.includes(id)) {
                currentIds.push(id);
                await songDoc.patch({
                  collectionIds: currentIds,
                  updatedAt: now,
                });
              }
            }
          }
          invalidateSongsCache();
        }

        invalidateCollectionsCache();
        showToast("Coleção criada com sucesso", "success");
        return doc.toJSON() as Collection;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao criar coleção",
            "error",
          );
        }
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast],
  );

  const updateCollection = useCallback(
    async ({
      id,
      name,
      description,
      color,
      icon,
      image,
      songIds,
    }: {
      id: string;
      name?: string;
      description?: string | null;
      color?: string;
      icon?: string;
      image?: string | null;
      songIds?: string[];
    }) => {
      setIsUpdating(true);
      try {
        const db = await getDatabase();
        const doc = await db.collections.findOne(id).exec();
        if (!doc) throw new Error(`Coleção com ID "${id}" não encontrada.`);

        if (name !== undefined) {
          await validateCollectionRules(db, { name, id }, { existingId: id });
        }

        const now = new Date().toISOString();
        const patchData: Record<string, unknown> = {
          updatedAt: now,
        };
        if (name !== undefined) patchData.name = name.trim();
        if (description !== undefined) patchData.description = description;
        if (color !== undefined) patchData.color = color;
        if (icon !== undefined) patchData.icon = icon;
        if (image !== undefined) patchData.image = image;
        if (songIds !== undefined) {
          patchData.songIds = songIds;
          patchData.songCount = songIds.length;

          const oldSongIds = new Set(
            Array.isArray(doc.songIds) ? doc.songIds : [],
          );
          const newSongIds = new Set(songIds);

          for (const sId of newSongIds) {
            if (!oldSongIds.has(sId)) {
              const songDoc = await db.songs.findOne(sId).exec();
              if (songDoc) {
                const currentIds = Array.isArray(songDoc.collectionIds)
                  ? [...songDoc.collectionIds]
                  : [];
                if (!currentIds.includes(id)) {
                  currentIds.push(id);
                  await songDoc.patch({
                    collectionIds: currentIds,
                    updatedAt: now,
                  });
                }
              }
            }
          }

          for (const sId of oldSongIds) {
            if (!newSongIds.has(sId)) {
              const songDoc = await db.songs.findOne(sId).exec();
              if (songDoc && Array.isArray(songDoc.collectionIds)) {
                const updatedIds = songDoc.collectionIds.filter(
                  (cid: string) => cid !== id,
                );
                await songDoc.patch({
                  collectionIds: updatedIds,
                  updatedAt: now,
                });
              }
            }
          }
          invalidateSongsCache();
        }

        await doc.patch(patchData);
        await updateCollectionCounts(db, id);
        invalidateCollectionsCache();
        showToast("Coleção atualizada", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao atualizar coleção",
            "error",
          );
        }
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast],
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      try {
        const db = await getDatabase();
        const doc = await db.collections.findOne(id).exec();
        if (doc) {
          const now = new Date().toISOString();
          const purgeAt = getPurgeAt();
          await doc.patch({
            isDeleted: true,
            purgeAt,
            updatedAt: now,
          });

          // Also remove collection reference from songs
          const songsInCollection = await db.songs
            .find({
              selector: {
                isDeleted: { $ne: true },
              },
            })
            .exec();

          for (const s of songsInCollection) {
            if (
              Array.isArray(s.collectionIds) &&
              s.collectionIds.includes(id)
            ) {
              const updatedIds = s.collectionIds.filter(
                (cid: string) => cid !== id,
              );
              await s.patch({
                collectionIds: updatedIds,
                updatedAt: now,
              });
            }
          }

          invalidateCollectionsCache();
          invalidateSongsCache();
        }
        showToast("Coleção enviada para a lixeira", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao excluir coleção",
            "error",
          );
        }
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [showToast],
  );

  const restoreCollection = useCallback(
    async (id: string) => {
      setIsRestoring(true);
      try {
        const db = await getDatabase();
        const doc = await db.collections.findOne(id).exec();
        if (doc) {
          await doc.patch({
            isDeleted: false,
            _deleted: false,
            purgeAt: null,
            updatedAt: new Date().toISOString(),
          });
          invalidateCollectionsCache();
        }
        showToast("Coleção restaurada", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao restaurar coleção",
            "error",
          );
        }
        throw err;
      } finally {
        setIsRestoring(false);
      }
    },
    [showToast],
  );

  const addSongsToCollection = useCallback(
    async (collectionId: string, songIds: string[]) => {
      try {
        const db = await getDatabase();
        const collectionDoc = await db.collections.findOne(collectionId).exec();
        if (!collectionDoc) throw new Error("Coleção não encontrada.");

        const now = new Date().toISOString();
        const existingSongIds: string[] = Array.isArray(collectionDoc.songIds)
          ? [...collectionDoc.songIds]
          : [];

        for (const sId of songIds) {
          if (!existingSongIds.includes(sId)) {
            existingSongIds.push(sId);
          }

          const songDoc = await db.songs.findOne(sId).exec();
          if (songDoc) {
            const currentCollIds: string[] = Array.isArray(
              songDoc.collectionIds,
            )
              ? [...songDoc.collectionIds]
              : [];
            if (!currentCollIds.includes(collectionId)) {
              currentCollIds.push(collectionId);
              await songDoc.patch({
                collectionIds: currentCollIds,
                updatedAt: now,
              });
            }
          }
        }

        await collectionDoc.patch({
          songIds: existingSongIds,
          songCount: existingSongIds.length,
          updatedAt: now,
        });

        await updateCollectionCounts(db, collectionId);
        invalidateCollectionsCache();
        invalidateSongsCache();
        showToast("Músicas adicionadas à coleção", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao adicionar músicas à coleção",
            "error",
          );
        }
        throw err;
      }
    },
    [showToast],
  );

  const removeSongsFromCollection = useCallback(
    async (collectionId: string, songIds: string[]) => {
      try {
        const db = await getDatabase();
        const collectionDoc = await db.collections.findOne(collectionId).exec();
        if (!collectionDoc) throw new Error("Coleção não encontrada.");

        const now = new Date().toISOString();
        const removeSet = new Set(songIds);
        const existingSongIds: string[] = (
          Array.isArray(collectionDoc.songIds) ? collectionDoc.songIds : []
        ).filter((sid: string) => !removeSet.has(sid));

        for (const sId of songIds) {
          const songDoc = await db.songs.findOne(sId).exec();
          if (songDoc && Array.isArray(songDoc.collectionIds)) {
            const currentCollIds = songDoc.collectionIds.filter(
              (cid: string) => cid !== collectionId,
            );
            await songDoc.patch({
              collectionIds: currentCollIds,
              updatedAt: now,
            });
          }
        }

        await collectionDoc.patch({
          songIds: existingSongIds,
          songCount: existingSongIds.length,
          updatedAt: now,
        });

        await updateCollectionCounts(db, collectionId);
        invalidateCollectionsCache();
        invalidateSongsCache();
        showToast("Músicas removidas da coleção", "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          showToast(
            (err as Error).message || "Falha ao remover músicas da coleção",
            "error",
          );
        }
        throw err;
      }
    },
    [showToast],
  );

  const {
    printCollection: openPrintCollection,
    printCollections: openPrintCollections,
  } = usePrint();

  const getCollectionSongs = useCallback(
    async (collectionId: string): Promise<Song[]> => {
      try {
        const db = await getDatabase();
        const collectionDoc = await db.collections.findOne(collectionId).exec();
        if (!collectionDoc) return [];
        const songIdSet = new Set(collectionDoc.songIds || []);
        const allSongsDocs = await db.songs
          .find({
            selector: {
              isDeleted: { $ne: true },
            },
          })
          .exec();
        return allSongsDocs
          .map((d) => d.toJSON() as Song)
          .filter(
            (s) =>
              songIdSet.has(s.id) ||
              (Array.isArray(s.collectionIds) &&
                s.collectionIds.includes(collectionId)),
          );
      } catch (err) {
        console.error("Failed to load songs for collection", err);
        return [];
      }
    },
    [],
  );

  const printCollection = useCallback(
    async (
      collection: Collection,
      songs?: Song[],
      options?: Partial<PrintOptions>,
    ) => {
      let resolvedSongs = songs;
      if (!resolvedSongs) {
        resolvedSongs = await getCollectionSongs(collection.id);
      }
      openPrintCollection(collection, resolvedSongs, options);
    },
    [getCollectionSongs, openPrintCollection],
  );

  const printCollections = useCallback(
    async (
      collectionsToPrint: Collection[],
      options?: Partial<PrintOptions>,
    ) => {
      const collectionsWithSongs = await Promise.all(
        collectionsToPrint.map(async (c) => ({
          collection: c,
          songs: await getCollectionSongs(c.id),
        })),
      );
      openPrintCollections(collectionsWithSongs, undefined, options);
    },
    [getCollectionSongs, openPrintCollections],
  );

  return {
    collections,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isRestoring,
    createCollection,
    updateCollection,
    deleteCollection,
    restoreCollection,
    addSongsToCollection,
    removeSongsFromCollection,
    getCollectionSongs,
    printCollection,
    printCollections,
  };
}

export function useCollection(id: string | null) {
  const { printCollection: openPrintCollection } = usePrint();
  const [collection, setCollection] = useState<Collection | null>(() =>
    id ? (cachedSingleCollections.get(id) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(() =>
    id ? !cachedSingleCollections.has(id) : false,
  );

  useEffect(() => {
    if (!id) {
      setCollection(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeCollection() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSub = db.collections.findOne(id as string).$.subscribe((doc) => {
          if (!isSubscribed) return;
          if (doc && !doc.isDeleted) {
            const data = doc.toJSON() as Collection;
            cachedSingleCollections.set(id as string, data);
            setCollection(data);
          } else {
            cachedSingleCollections.delete(id as string);
            setCollection(null);
          }
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to find collection in database", err);
        setIsLoading(false);
      }
    }

    void subscribeCollection();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [id]);

  const printCollection = useCallback(
    async (songs?: Song[], options?: Partial<PrintOptions>) => {
      if (!collection) return;
      let resolvedSongs = songs;
      if (!resolvedSongs) {
        try {
          const db = await getDatabase();
          const songIdSet = new Set(collection.songIds || []);
          const allSongsDocs = await db.songs
            .find({
              selector: {
                isDeleted: { $ne: true },
              },
            })
            .exec();
          resolvedSongs = allSongsDocs
            .map((d) => d.toJSON() as Song)
            .filter(
              (s) =>
                songIdSet.has(s.id) ||
                (Array.isArray(s.collectionIds) &&
                  s.collectionIds.includes(collection.id)),
            );
        } catch (err) {
          console.error("Failed to load songs for collection print", err);
          resolvedSongs = [];
        }
      }
      openPrintCollection(collection, resolvedSongs, options);
    },
    [collection, openPrintCollection],
  );

  return {
    data: collection,
    isLoading,
    isPending: isLoading,
    printCollection,
  };
}
