/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Collection, Song } from "@/src/types";
import { Check, Search } from "lucide-react";
import React, { useMemo, useState } from "react";

interface AddSongsToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  allSongs: Song[];
  onAddSongs: (songIds: string[]) => Promise<void>;
}

export const AddSongsToCollectionModal: React.FC<
  AddSongsToCollectionModalProps
> = ({ isOpen, onClose, collection, allSongs, onAddSongs }) => {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingSongIds = useMemo(() => {
    return new Set(collection.songIds || []);
  }, [collection.songIds]);

  const availableSongs = useMemo(() => {
    const list = allSongs.filter((song) => !existingSongIds.has(song.id));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.tags?.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [allSongs, existingSongIds, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedSongIds.size === availableSongs.length) {
      setSelectedSongIds(new Set());
    } else {
      setSelectedSongIds(new Set(availableSongs.map((s) => s.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedSongIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await onAddSongs(Array.from(selectedSongIds));
      setSelectedSongIds(new Set());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        locale === "pt"
          ? `Adicionar Músicas a "${collection.name}"`
          : `Add Songs to "${collection.name}"`
      }
    >
      <div className="flex flex-col gap-4 max-h-[75vh]">
        {/* Search */}
        <div className="relative">
          <Input
            placeholder={
              locale === "pt"
                ? "Pesquisar por título ou artista..."
                : "Search by title or artist..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {/* Selection Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            {locale === "pt"
              ? `${selectedSongIds.size} selecionada(s)`
              : `${selectedSongIds.size} selected`}
          </span>
          {availableSongs.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
            >
              {selectedSongIds.size === availableSongs.length
                ? locale === "pt"
                  ? "Desmarcar todas"
                  : "Deselect all"
                : locale === "pt"
                  ? "Selecionar todas"
                  : "Select all"}
            </button>
          )}
        </div>

        {/* Songs List */}
        <div className="flex-1 min-h-48 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 pr-1">
          {availableSongs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {locale === "pt"
                ? "Nenhuma música disponível para adicionar."
                : "No available songs to add."}
            </div>
          ) : (
            availableSongs.map((song) => {
              const isSelected = selectedSongIds.has(song.id);
              const keyMatch = song.content
                ?.match(/\{key:\s*([^}]+)\}/i)?.[1]
                ?.trim();

              return (
                <div
                  key={song.id}
                  onClick={() => toggleSelect(song.id)}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-sky-600 border-sky-600 text-white"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {song.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {song.artist}
                      </span>
                    </div>
                  </div>

                  {keyMatch && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {keyMatch}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedSongIds.size === 0 || isSubmitting}
          >
            {isSubmitting
              ? t("common.loading")
              : locale === "pt"
                ? `Adicionar (${selectedSongIds.size})`
                : `Add (${selectedSongIds.size})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
