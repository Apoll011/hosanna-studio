/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, ConfirmDialog, Spinner } from "@/src/components/common";
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
  ExternalLink,
  FolderKanban,
  MoreHorizontal,
  Music2,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

export const CollectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Local search (within collection)
  const [localSearch, setLocalSearch] = useState("");

  // Modals & menus
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [songToRemove, setSongToRemove] = useState<Song | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [hoveredSongId, setHoveredSongId] = useState<string | null>(null);
  const [activeSongMenuId, setActiveSongMenuId] = useState<string | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        headerMenuRef.current &&
        !headerMenuRef.current.contains(e.target as Node)
      ) {
        setIsHeaderMenuOpen(false);
      }
      setActiveSongMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, localSearch]);

  // Songs in this collection (union of both sides of the relationship)
  const songsInCollection = useMemo(() => {
    if (!collection) return [];
    const songIdSet = new Set(collection.songIds || []);
    return allSongs.filter(
      (song) =>
        songIdSet.has(song.id) ||
        (Array.isArray(song.collectionIds) &&
          song.collectionIds.includes(collection.id)),
    );
  }, [collection, allSongs]);

  // Apply both global and local search filters
  const filteredSongs = useMemo(() => {
    let result = songsInCollection;
    const gq = searchQuery.trim().toLowerCase();
    if (gq) {
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(gq) ||
          s.artist.toLowerCase().includes(gq) ||
          s.tags?.some((tag) => tag.toLowerCase().includes(gq)),
      );
    }
    const lq = localSearch.trim().toLowerCase();
    if (lq) {
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(lq) ||
          s.artist.toLowerCase().includes(lq) ||
          s.tags?.some((tag) => tag.toLowerCase().includes(lq)),
      );
    }
    return result;
  }, [songsInCollection, searchQuery, localSearch]);

  // Pagination
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
    await updateCollection({ id: collection.id, ...data });
    setIsEditModalOpen(false);
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

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isCollectionLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Spinner size="lg" label={t("common.loading")} />
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────────────────────
  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <FolderKanban className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t("collectionsPage.notFoundTitle")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("collectionsPage.notFoundDesc")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(`${slugPrefix}/collections`)}
        >
          {t("collectionsPage.backToCollections")}
        </Button>
      </div>
    );
  }

  const IconComp = getFolderIconComponent(collection.icon);
  const colorStyle = getFolderColorStyle(collection.color);
  const songCount = songsInCollection.length;
  const isFiltering = localSearch.trim() !== "" || searchQuery.trim() !== "";

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-m3-bg">
      {/* ── HERO BANNER ──────────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ minHeight: 220 }}
      >
        {/* Background */}
        {collection.image ? (
          <img
            src={collection.image}
            alt={collection.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${colorStyle.colorHex}30 0%, ${colorStyle.colorHex}90 60%, ${colorStyle.colorHex}cc 100%)`,
            }}
          />
        )}
        {/* Scrim */}
        <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/20 to-transparent" />

        {/* Collection identity */}
        <div className="relative z-10 flex items-end gap-4 px-6 sm:px-8 pb-6 pt-16">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white shadow-2xl shrink-0 border-2 border-white/20"
            style={{ backgroundColor: colorStyle.colorHex }}
          >
            <IconComp className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="flex flex-col min-w-0 pb-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/55 mb-0.5">
              Collection
            </p>
            <h1 className="text-2xl sm:text-4xl font-black text-white drop-shadow-md truncate leading-tight">
              {collection.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-medium text-white/70">
                {t(
                  `collectionsPage.songCount.${songCount === 1 ? "one" : "other"}`,
                  { count: songCount },
                )}
              </span>
              {collection.description && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/60 line-clamp-1">
                    {collection.description}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top-right actions */}
        <div
          ref={headerMenuRef}
          className="absolute top-4 right-4 z-10 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setIsAddSongsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/15 hover:bg-white/28 backdrop-blur-sm text-white text-xs font-semibold transition-all cursor-pointer shadow-md border border-white/10"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("collectionsPage.addSongs")}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen((v) => !v)}
              className="p-2.5 rounded-2xl bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all cursor-pointer shadow-md"
              title={t("explorer.moreOptions")}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {isHeaderMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-30 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Edit2 className="w-3.5 h-3.5 text-sky-500" />
                  {t("collectionsPage.editCollection")}
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
                  {t("collectionsPage.addSongs")}
                </button>
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setIsDeleteDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("collectionsPage.deleteTitle")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-4">
        {paginatedSongs.length === 0 ? (
          /* Empty / No-results state */
          <div
            className={`mt-4 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 py-16 px-8 text-center transition-all ${
              !isFiltering
                ? "border-slate-200 dark:border-slate-700/70 hover:border-m3-primary/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/20 cursor-pointer group"
                : "border-slate-200 dark:border-slate-700/50"
            }`}
            onClick={() => !isFiltering && setIsAddSongsModalOpen(true)}
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 group-hover:bg-m3-primary/10 flex items-center justify-center transition-colors">
              <Music2 className="w-7 h-7 text-slate-400 dark:text-slate-500 group-hover:text-m3-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {songsInCollection.length === 0
                  ? t("collectionsPage.emptyTitle")
                  : t("collectionsPage.noSearchResultsTitle")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                {songsInCollection.length === 0
                  ? t("collectionsPage.emptyDesc")
                  : t("collectionsPage.noSearchResultsDesc", {
                      query: localSearch || searchQuery,
                    })}
              </p>
            </div>
            {!isFiltering && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddSongsModalOpen(true);
                }}
              >
                {t("collectionsPage.addSongs")}
              </Button>
            )}
          </div>
        ) : (
          /* Song table */
          <div className="bg-m3-card border border-m3-border rounded-3xl shadow-sm overflow-hidden flex flex-col transition-all">
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_auto_6.5rem] gap-3 items-center px-6 py-3.5 border-b border-m3-border bg-m3-sidebar/40">
              <span className="text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em] text-center">
                #
              </span>
              <span className="text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em]">
                {t("songsPage.titlePath")}
              </span>
              <span className="hidden sm:block text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em] text-right">
                {t("songsPage.tags")}
              </span>
              <span className="text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em] text-right">
                {t("songsPage.actions")}
              </span>
            </div>

            <div className="divide-y divide-m3-border/30 text-[13px] font-bold">
              {paginatedSongs.map((song, index) => {
                const globalIndex =
                  (currentPage - 1) * itemsPerPage + index + 1;
                const keyMatch = song.content
                  ?.match(/\{key:\s*([^}]+)\}/i)?.[1]
                  ?.trim();
                const isMenuOpen = activeSongMenuId === song.id;
                const isHovered = hoveredSongId === song.id;

                return (
                  <div
                    key={song.id}
                    onMouseEnter={() => setHoveredSongId(song.id)}
                    onMouseLeave={() => setHoveredSongId(null)}
                    className={`grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_auto_6.5rem] gap-3 items-center px-6 py-3.5 transition-all select-none cursor-pointer ${
                      isHovered ? "bg-m3-hover/50 text-m3-text" : "text-m3-text"
                    }`}
                  >
                    {/* Index / Play icon on hover */}
                    <span
                      className="text-center"
                      onClick={() => navigate(`${slugPrefix}/songs/${song.id}`)}
                    >
                      {isHovered ? (
                        <Music2 className="w-3.5 h-3.5 mx-auto text-m3-primary" />
                      ) : (
                        <span className="text-[11px] text-m3-secondary opacity-70 font-black uppercase tracking-tighter">
                          {globalIndex}
                        </span>
                      )}
                    </span>

                    {/* Title + Artist */}
                    <div
                      className="flex flex-col min-w-0"
                      onClick={() => navigate(`${slugPrefix}/songs/${song.id}`)}
                    >
                      <span className="truncate font-bold group-hover:translate-x-1 transition-transform">
                        {song.title}
                      </span>
                      <span className="text-[10px] text-m3-secondary font-black uppercase tracking-widest opacity-60 mt-0.5 truncate">
                        {song.artist || "—"}
                      </span>
                    </div>

                    {/* Tags + Key (desktop) */}
                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
                      {keyMatch && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                          {keyMatch}
                        </span>
                      )}
                      {song.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {(song.tags?.length ?? 0) > 2 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          +{(song.tags?.length ?? 0) - 2}
                        </span>
                      )}
                    </div>

                    {/* Row actions */}
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isHovered && !isMenuOpen && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`${slugPrefix}/songs/${song.id}`)
                          }
                          className="p-1.5 text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 rounded-xl cursor-pointer transition-all"
                          title={t("collectionsPage.viewSong")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isHovered && !isMenuOpen && (
                        <button
                          type="button"
                          onClick={() => setSongToRemove(song)}
                          className="p-1.5 text-m3-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl cursor-pointer transition-all"
                          title={t("collectionsPage.removeFromCollection")}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSongMenuId(isMenuOpen ? null : song.id);
                          }}
                          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                            isMenuOpen
                              ? "bg-m3-primary/10 text-m3-primary"
                              : isHovered
                                ? "text-m3-secondary hover:text-m3-text hover:bg-m3-hover"
                                : "text-transparent"
                          }`}
                          title={t("explorer.moreOptions")}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-30 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSongMenuId(null);
                                navigate(`${slugPrefix}/songs/${song.id}`);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                            >
                              <Music2 className="w-3.5 h-3.5 text-sky-500" />
                              {t("collectionsPage.viewSong")}
                            </button>
                            {song.tags && song.tags.length > 0 && (
                              <div className="px-3 py-1.5 flex flex-wrap gap-1">
                                {song.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                  >
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSongMenuId(null);
                                setSongToRemove(song);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                            >
                              <X className="w-3.5 h-3.5" />
                              {t("collectionsPage.removeFromCollection")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-m3-sidebar/30 border-t border-m3-border flex items-center justify-between text-xs">
                <span className="text-m3-secondary font-medium">
                  {t("collectionsPage.paginationInfo", {
                    from: Math.min(
                      (currentPage - 1) * itemsPerPage + 1,
                      totalSongs,
                    ),
                    to: Math.min(currentPage * itemsPerPage, totalSongs),
                    total: totalSongs,
                  })}
                </span>
                <div className="flex items-center gap-1 bg-m3-card border border-m3-border rounded-xl p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg text-m3-secondary hover:text-m3-text hover:bg-m3-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

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
                          {showEllipsis && (
                            <span className="px-1 text-m3-secondary opacity-50">
                              …
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              currentPage === p
                                ? "bg-m3-primary text-white shadow-sm"
                                : "hover:bg-m3-hover text-m3-text"
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg text-m3-secondary hover:text-m3-text hover:bg-m3-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      <CreateCollectionModal
        isOpen={isEditModalOpen}
        collection={collection}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdate}
      />

      <AddSongsToCollectionModal
        isOpen={isAddSongsModalOpen}
        collection={collection}
        allSongs={allSongs}
        onClose={() => setIsAddSongsModalOpen(false)}
        onAddSongs={handleAddSongs}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={t("collectionsPage.deleteTitle")}
        message={t("collectionsPage.deletePermanentMessage", {
          name: collection.name,
        })}
        confirmText={t("collectionsPage.delete")}
        cancelText={t("common.cancel")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={Boolean(songToRemove)}
        onClose={() => setSongToRemove(null)}
        onConfirm={handleRemoveSong}
        title={t("collectionsPage.removeSongTitle")}
        message={t("collectionsPage.removeSongMessage", {
          title: songToRemove?.title ?? "",
        })}
        confirmText={t("collectionsPage.removeFromCollection")}
        cancelText={t("common.cancel")}
        variant="danger"
      />
    </div>
  );
};
