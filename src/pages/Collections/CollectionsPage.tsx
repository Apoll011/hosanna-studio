/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfirmDialog, EmptyState, Spinner } from "@/src/components/common";
import { CreateCollectionModal } from "@/src/components/modals/CreateCollectionModal";
import { useAuth } from "@/src/contexts/AuthContext";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useCollections } from "@/src/hooks/useCollections";
import { useI18n } from "@/src/lib/i18n";
import { Collection } from "@/src/types";
import {
  getFolderColorStyle,
  getFolderIconComponent,
} from "@/src/utils/folderCustomization";
import { Edit2, LibraryBig, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

type CollectionSortBy = "updatedAt" | "title" | "number";

export const CollectionsPage: React.FC = () => {
  const { navigate } = useAppNavigate();
  const { t, locale } = useI18n();
  const { organization, user } = useAuth();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";

  const { searchQuery, sortBy } = useOutletContext<{
    searchQuery: string;
    sortBy: CollectionSortBy;
  }>();

  const {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useCollections();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  );
  const [deletingCollection, setDeletingCollection] =
    useState<Collection | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Filtered & Sorted collections
  const filteredCollections = useMemo(() => {
    let result = [...collections];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "number") {
        const countA = a.songCount ?? a.songIds?.length ?? 0;
        const countB = b.songCount ?? b.songIds?.length ?? 0;
        return countB - countA;
      }
      // Recent (default)
      const dateA = a.updatedAt || a.createdAt || "";
      const dateB = b.updatedAt || b.createdAt || "";
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [collections, searchQuery, sortBy, user?.id, organization?.id]);

  const handleCreateSubmit = async (data: {
    name: string;
    description?: string | null;
    color?: string;
    icon?: string;
    image?: string | null;
  }) => {
    await createCollection(data);
  };

  const handleUpdateSubmit = async (data: {
    name: string;
    description?: string | null;
    color?: string;
    icon?: string;
    image?: string | null;
  }) => {
    if (!editingCollection) return;
    await updateCollection({
      id: editingCollection.id,
      ...data,
    });
    setEditingCollection(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCollection) return;
    await deleteCollection(deletingCollection.id);
    setDeletingCollection(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-m3-bg">
        <Spinner size="lg" label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-m3-bg">
      {/* COLLECTIONS GRID */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Card 1: Nova Coleção Card */}
          <div
            onClick={() => setIsCreateModalOpen(true)}
            className="group relative rounded-3xl border-2 border-dashed border-sky-300 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/10 hover:bg-sky-50 dark:hover:bg-sky-950/20 hover:border-sky-400 dark:hover:border-sky-600 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-8 text-center min-h-60 shadow-xs hover:shadow-md"
          >
            <div className="w-14 h-14 rounded-2xl bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 shadow-sm">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {locale === "pt" ? "Nova Coleção" : "New Collection"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-48">
              {locale === "pt"
                ? "Crie uma nova coleção para organizar suas músicas."
                : "Create a new collection to organize your songs."}
            </p>
          </div>

          {/* Collection Cards */}
          {filteredCollections.map((collection) => {
            const IconComp = getFolderIconComponent(collection.icon);
            const colorStyle = getFolderColorStyle(collection.color);
            const songCount =
              collection.songCount ?? collection.songIds?.length ?? 0;
            const isMenuOpen = openMenuId === collection.id;

            return (
              <div
                key={collection.id}
                onClick={() =>
                  navigate(`${slugPrefix}/collections/${collection.id}`)
                }
                className="group relative rounded-3xl border border-m3-border/80 bg-white dark:bg-m3-card overflow-hidden hover:shadow-xl hover:border-m3-primary/40 transition-all duration-300 cursor-pointer flex flex-col min-h-60"
              >
                {/* Banner / Header */}
                <div className="relative h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {collection.image ? (
                    <img
                      src={collection.image}
                      alt={collection.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full opacity-85 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: `linear-gradient(135deg, ${colorStyle.colorHex}25 0%, ${colorStyle.colorHex}70 100%)`,
                      }}
                    />
                  )}
                </div>

                {/* Badge Icon & Context Menu */}
                <div className="relative px-5 pt-0 pb-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between -mt-6 mb-3">
                    {/* Floating Badge */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg border-2 border-white dark:border-m3-card shrink-0 transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: colorStyle.colorHex }}
                    >
                      <IconComp className="w-6 h-6" />
                    </div>

                    {/* Three Dots Menu Button */}
                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : collection.id);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={t("explorer.moreOptions")}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              setEditingCollection(collection);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-sky-500" />
                            {locale === "pt" ? "Editar" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              setDeletingCollection(collection);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            {locale === "pt" ? "Excluir" : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Count */}
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-m3-primary transition-colors">
                    {collection.name}
                  </h4>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                    {locale === "pt"
                      ? `${songCount} ${songCount === 1 ? "música" : "músicas"}`
                      : `${songCount} ${songCount === 1 ? "song" : "songs"}`}
                  </span>

                  {/* Description */}
                  {collection.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                      {collection.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state when search filters return nothing */}
        {filteredCollections.length === 0 && searchQuery && (
          <div className="py-16 text-center">
            <EmptyState
              icon={<LibraryBig className="w-12 h-12 text-slate-400 mx-auto" />}
              title={
                locale === "pt"
                  ? "Nenhuma coleção encontrada"
                  : "No collections found"
              }
              description={
                locale === "pt"
                  ? `Nenhum resultado correspondente a "${searchQuery}".`
                  : `No results matching "${searchQuery}".`
              }
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateSubmit}
      />

      {/* Edit Modal */}
      {editingCollection && (
        <CreateCollectionModal
          isOpen={Boolean(editingCollection)}
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
          onSave={handleUpdateSubmit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingCollection)}
        onClose={() => setDeletingCollection(null)}
        onConfirm={handleDeleteConfirm}
        title={locale === "pt" ? "Excluir Coleção" : "Delete Collection"}
        message={
          locale === "pt"
            ? `Tem certeza que deseja enviar a coleção "${deletingCollection?.name}" para a lixeira? As músicas continuarão salvas na biblioteca.`
            : `Are you sure you want to move the collection "${deletingCollection?.name}" to trash? Songs will remain in your library.`
        }
        confirmText={locale === "pt" ? "Excluir" : "Delete"}
        cancelText={t("common.cancel")}
        variant="danger"
      />
    </div>
  );
};
