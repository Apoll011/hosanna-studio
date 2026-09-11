/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from "@/src/components/common";
import { AddSongsToCollectionModal } from "@/src/components/modals/AddSongsToCollectionModal";
import { CreateCollectionModal } from "@/src/components/modals/CreateCollectionModal";
import { useAuth } from "@/src/contexts/AuthContext";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useCollection, useCollections } from "@/src/hooks/useCollections";
import { useAllSongs } from "@/src/hooks/useSongs";
import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import {
  getFolderColorStyle,
  getFolderIconComponent,
} from "@/src/utils/folderCustomization";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FolderKanban,
  MoreHorizontal,
  Music,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

export const CollectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useAppNavigate();
  const { t, locale } = useI18n();
  const { organization } = useAuth();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";

  const { data: collection, isLoading: isCollectionLoading } = useCollection(
    id || null,
  );

  const { searchQuery } = useOutletContext<{
    searchQuery: string;
  }>();

  const {
    updateCollection,
    deleteCollection,
    addSongsToCollection,
    removeSongsFromCollection,
  } = useCollections();

  const { songsQuery } = useAllSongs();
  const allSongs = useMemo(
    () => (Array.isArray(songsQuery.data?.songs) ? songsQuery.data.songs : []),
    [songsQuery.data?.songs],
  );

  // Search & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [songToRemove, setSongToRemove] = useState<Song | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [activeSongMenuId, setActiveSongMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setIsHeaderMenuOpen(false);
      setActiveSongMenuId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Filter songs belonging to this collection
  const songsInCollection = useMemo(() => {
    if (!collection) return [];
    const songIdSet = new Set(collection.songIds || []);
    console.log(songIdSet);
    return allSongs.filter(
      (song) =>
        songIdSet.has(song.id) ||
        (Array.isArray(song.collectionIds) &&
          song.collectionIds.includes(collection.id)),
    );
  }, [collection, allSongs]);

  // Search filtered songs
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songsInCollection;
    const q = searchQuery.toLowerCase().trim();
    return songsInCollection.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [songsInCollection, searchQuery]);

  // Pagination calculation
  const totalSongs = filteredSongs.length;
  const totalPages = Math.ceil(totalSongs / itemsPerPage) || 1;
  const paginatedSongs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSongs.slice(start, start + itemsPerPage);
  }, [filteredSongs, currentPage]);

  const handleUpdate = async (data: {
    name: string;
    description?: string | null;
    color?: string;
    icon?: string;
    image?: string | null;
  }) => {
    if (!collection) return;
    await updateCollection({
      id: collection.id,
      ...data,
    });
  };

  const handleDelete = async () => {
    if (!collection) return;
    await deleteCollection(collection.id);
    navigate(`${slugPrefix}/collections`);
  };

  const handleAddSongs = async (songIds: string[]) => {
    if (!collection) return;
    await addSongsToCollection(collection.id, songIds);
  };

  const handleRemoveSong = async () => {
    if (!collection || !songToRemove) return;
    await removeSongsFromCollection(collection.id, [songToRemove.id]);
    setSongToRemove(null);
  };

  if (isCollectionLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-m3-bg">
        <Spinner size="lg" label={t("common.loading")} />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-m3-bg text-center">
        <EmptyState
          icon={<FolderKanban className="w-12 h-12 text-slate-400 mx-auto" />}
          title={
            locale === "pt" ? "Coleção não encontrada" : "Collection not found"
          }
          description={
            locale === "pt"
              ? "A coleção que você procura pode ter sido removida."
              : "The collection you are looking for may have been removed."
          }
          actionLabel={
            locale === "pt" ? "Voltar para Coleções" : "Back to Collections"
          }
          onAction={() => navigate(`${slugPrefix}/collections`)}
        />
      </div>
    );
  }

  const IconComp = getFolderIconComponent(collection.icon);
  const colorStyle = getFolderColorStyle(collection.color);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-m3-bg">
      {/* Top Banner */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {collection.image ? (
          <img
            src={collection.image}
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${colorStyle.colorHex}35 0%, ${colorStyle.colorHex}80 100%)`,
            }}
          />
        )}

        {/* Back navigation floating button */}
        <button
          onClick={() => navigate(`${slugPrefix}/collections`)}
          className="absolute top-4 left-4 p-2.5 rounded-2xl bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all cursor-pointer shadow-md"
          title={
            locale === "pt" ? "Voltar para Coleções" : "Back to Collections"
          }
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Collection Header Content */}
      <div className="px-6 sm:px-8 pb-6 border-b border-m3-border/70">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
          <div className="flex items-end gap-4 min-w-0">
            {/* Floating Square Icon Badge */}
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center text-white shadow-xl border-4 border-white dark:border-m3-bg shrink-0 transition-transform"
              style={{ backgroundColor: colorStyle.colorHex }}
            >
              <IconComp className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <div className="flex flex-col min-w-0 pb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 truncate">
                {collection.name}
              </h1>
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {locale === "pt"
                  ? `${songsInCollection.length} ${
                      songsInCollection.length === 1 ? "música" : "músicas"
                    }`
                  : `${songsInCollection.length} ${
                      songsInCollection.length === 1 ? "song" : "songs"
                    }`}
              </span>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="flex items-center gap-2 self-end sm:self-center relative">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddSongsModalOpen(true)}
            >
              {locale === "pt" ? "Adicionar Músicas" : "Add Songs"}
            </Button>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsHeaderMenuOpen((v) => !v)}
                className="p-2 rounded-2xl border border-m3-border bg-m3-card hover:bg-m3-hover text-m3-secondary hover:text-m3-text transition-all cursor-pointer shadow-xs"
                title={t("explorer.moreOptions")}
              >
                <MoreHorizontal className="w-4.5 h-4.5" />
              </button>

              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsEditModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-sky-500" />
                    {locale === "pt" ? "Editar Coleção" : "Edit Collection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsAddSongsModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                    {locale === "pt" ? "Adicionar Músicas" : "Add Songs"}
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsDeleteDialogOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    {locale === "pt" ? "Excluir Coleção" : "Delete Collection"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {collection.description && (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
            {collection.description}
          </p>
        )}
      </div>

      <div className="flex-1 p-6 sm:px-8">
        {paginatedSongs.length === 0 ? (
          <div className="py-16 text-center">
            <EmptyState
              icon={<Music className="w-12 h-12 text-slate-400 mx-auto" />}
              title={
                songsInCollection.length === 0
                  ? locale === "pt"
                    ? "Esta coleção ainda não possui músicas"
                    : "This collection does not have songs yet"
                  : locale === "pt"
                    ? "Nenhuma música correspondente encontrada"
                    : "No matching songs found"
              }
              description={
                songsInCollection.length === 0
                  ? locale === "pt"
                    ? "Adicione músicas da sua biblioteca a esta coleção para organizá-las."
                    : "Add songs from your library to organize them in this collection."
                  : locale === "pt"
                    ? `Nenhuma música encontrada para "${searchQuery}".`
                    : `No songs found for "${searchQuery}".`
              }
              actionLabel={locale === "pt" ? "Adicionar Músicas" : "Add Songs"}
              onAction={() => setIsAddSongsModalOpen(true)}
            />
          </div>
        ) : (
          <div className="divide-y divide-m3-border/50 rounded-2xl border border-m3-border/80 bg-white dark:bg-m3-card overflow-hidden shadow-xs">
            {paginatedSongs.map((song, index) => {
              const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
              const keyMatch = song.content
                ?.match(/\{key:\s*([^}]+)\}/i)?.[1]
                ?.trim();
              const isMenuOpen = activeSongMenuId === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => navigate(`${slugPrefix}/songs/${song.id}`)}
                  className="group flex items-center justify-between p-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {/* Left: Number & Title/Artist (No song image!) */}
                  <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
                    <span className="w-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                      {globalIndex}
                    </span>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-m3-primary transition-colors truncate">
                        {song.title}
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        {song.artist}
                      </span>
                    </div>
                  </div>

                  {/* Right: Key badge and 3-dots menu */}
                  <div
                    className="flex items-center gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {keyMatch && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {keyMatch}
                      </span>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSongMenuId(isMenuOpen ? null : song.id);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={t("explorer.moreOptions")}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSongMenuId(null);
                              navigate(`${slugPrefix}/songs/${song.id}`);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                          >
                            <Music className="w-3.5 h-3.5 text-sky-500" />
                            {locale === "pt" ? "Ver Música" : "View Song"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSongMenuId(null);
                              setSongToRemove(song);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                          >
                            <X className="w-3.5 h-3.5 text-rose-500" />
                            {locale === "pt"
                              ? "Remover da Coleção"
                              : "Remove from Collection"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalSongs > 0 && (
        <div className="px-6 sm:px-8 py-3 bg-white dark:bg-m3-bg border-t border-m3-border/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-auto">
          <span>
            {locale === "pt"
              ? `${Math.min(
                  (currentPage - 1) * itemsPerPage + 1,
                  totalSongs,
                )} a ${Math.min(
                  currentPage * itemsPerPage,
                  totalSongs,
                )} de ${totalSongs} músicas`
              : `${Math.min(
                  (currentPage - 1) * itemsPerPage + 1,
                  totalSongs,
                )} to ${Math.min(
                  currentPage * itemsPerPage,
                  totalSongs,
                )} of ${totalSongs} songs`}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - currentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            currentPage === p
                              ? "bg-m3-primary text-white"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Collection Modal */}
      <CreateCollectionModal
        isOpen={isEditModalOpen}
        collection={collection}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdate}
      />

      {/* Add Songs Modal */}
      <AddSongsToCollectionModal
        isOpen={isAddSongsModalOpen}
        collection={collection}
        allSongs={allSongs}
        onClose={() => setIsAddSongsModalOpen(false)}
        onAddSongs={handleAddSongs}
      />

      {/* Delete Collection Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={locale === "pt" ? "Excluir Coleção" : "Delete Collection"}
        message={
          locale === "pt"
            ? `Tem certeza que deseja excluir a coleção "${collection.name}"? As músicas permanecerão disponíveis na biblioteca.`
            : `Are you sure you want to delete "${collection.name}"? Songs will remain in your library.`
        }
        confirmText={locale === "pt" ? "Excluir" : "Delete"}
        cancelText={t("common.cancel")}
        variant="danger"
      />

      {/* Remove Song from Collection Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(songToRemove)}
        onClose={() => setSongToRemove(null)}
        onConfirm={handleRemoveSong}
        title={
          locale === "pt" ? "Remover da Coleção" : "Remove from Collection"
        }
        message={
          locale === "pt"
            ? `Deseja remover "${songToRemove?.title}" desta coleção? A música continuará salva na biblioteca.`
            : `Do you want to remove "${songToRemove?.title}" from this collection? The song will remain in the library.`
        }
        confirmText={locale === "pt" ? "Remover" : "Remove"}
        cancelText={t("common.cancel")}
        variant="danger"
      />
    </div>
  );
};
