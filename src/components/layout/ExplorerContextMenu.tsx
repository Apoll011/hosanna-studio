/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Folder, Song } from "@/src/types";
import {
  ArrowRightLeft,
  CheckSquare,
  Edit2,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Move,
  Palette,
  Plus,
  Printer,
  RotateCw,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React from "react";
import { Can, CanAll } from "../../lib/permissions/components";
import { ActiveModal } from "./ExplorerModals";

export interface ContextMenuState {
  x: number;
  y: number;
  type: "folder" | "song" | "canvas";
  item?: Folder | Song | null;
}

export interface ExplorerContextMenuProps {
  contextMenu: ContextMenuState | null;
  currentFolder: Folder | undefined;
  totalSelectedCount: number;
  selectedSongIds: Set<string>;
  selectedFolderIds: Set<string>;
  slugPrefix: string;
  navigate: (path: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onOpenModal: (modal: ActiveModal) => void;
  onSelectAll: () => void;
  onRefreshView: () => void;
  onClearSelection: () => void;
  onSelectFolder: (id: string) => void;
  onCustomizeFolder?: (folder: Folder) => void;
  onRenameFolder: (folder: Folder) => void;
  onMoveFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onMoveSong: (song: Song) => void;
  onTagSong: (song: Song) => void;
  onAddToCollection?: (song: Song) => void;
  onDeleteSong: (song: Song) => void;
  onPrintSongs?: () => void;
  onPrintFolders?: () => void;
  onPrintSong?: (id: string) => void;
  onPrintFolder?: (id: string) => void;
}

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  contextMenu,
  currentFolder,
  totalSelectedCount,
  selectedSongIds,
  selectedFolderIds,
  slugPrefix,
  navigate,
  fileInputRef,
  onClose,
  onOpenModal,
  onSelectAll,
  onRefreshView,
  onClearSelection,
  onSelectFolder,
  onCustomizeFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onMoveSong,
  onTagSong,
  onAddToCollection,
  onDeleteSong,
  onPrintSongs,
  onPrintFolders,
  onPrintSong,
  onPrintFolder,
}) => {
  const { t } = useI18n();

  if (!contextMenu) return null;

  return (
    <div
      style={{ top: contextMenu.y, left: contextMenu.x }}
      className="fixed z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.type === "canvas" ? (
        <>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 mb-0.5 truncate flex items-center justify-between">
            <span>
              {currentFolder
                ? currentFolder.name
                : t("explorer.contextMenu.rootDirectory")}
            </span>
            <span className="text-[9px] text-slate-400 font-normal">
              {t("explorer.contextMenu.options")}
            </span>
          </div>

          <Can permission="folder.create">
            <button
              onClick={() => {
                onOpenModal("create-folder");
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-500" />
              <span>{t("explorer.contextMenu.newFolder")}</span>
            </button>
          </Can>

          <Can permission="song.create">
            <button
              onClick={() => {
                onOpenModal("create-song");
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
            >
              <Plus className="w-4 h-4 text-sky-600" />
              <span>{t("explorer.contextMenu.newSong")}</span>
            </button>
          </Can>

          <Can permission="song.import">
            <button
              onClick={() => {
                fileInputRef.current?.click();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-600" />
              <span>{t("explorer.contextMenu.uploadFiles")}</span>
            </button>
          </Can>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

          <button
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-slate-500" />
            <span>{t("explorer.contextMenu.selectAll")}</span>
          </button>

          <button
            onClick={() => {
              onRefreshView();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-slate-500" />
            <span>{t("explorer.contextMenu.refreshView")}</span>
          </button>
        </>
      ) : totalSelectedCount > 1 ? (
        <>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-600 border-b border-slate-100 dark:border-slate-800/80 mb-0.5 truncate flex items-center justify-between">
            <span>{t("explorer.contextMenu.multiSelect")}</span>
            <Badge variant="sky">{totalSelectedCount}</Badge>
          </div>

          {selectedSongIds.size > 0 && (
            <>
              <Can permission="song.update">
                <button
                  onClick={() => {
                    onOpenModal("batch-tag");
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-sky-600" />
                  <span>
                    {t("explorer.contextMenu.tagSongsCount", {
                      count: selectedSongIds.size,
                    })}
                  </span>
                </button>
                <button
                  onClick={() => {
                    onOpenModal("batch-add-to-collection");
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span>
                    {t("explorer.contextMenu.addToCollectionCount", {
                      count: selectedSongIds.size,
                    })}
                  </span>
                </button>
              </Can>
              <Can permission="export.pdf">
                <button
                  onClick={() => {
                    onPrintSongs?.();
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-sky-600" />
                  <span>
                    {t("explorer.contextMenu.printSongsCount", {
                      count: selectedSongIds.size,
                    })}
                  </span>
                </button>
              </Can>
            </>
          )}

          {selectedFolderIds.size > 0 && (
            <Can permission="export.pdf">
              <button
                onClick={() => {
                  onPrintFolders?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-600" />
                <span>
                  {t("explorer.contextMenu.printFoldersCount", {
                    count: selectedFolderIds.size,
                  })}
                </span>
              </button>
            </Can>
          )}

          <CanAll permissions={["song.update", "folder.update"]}>
            <button
              onClick={() => {
                onOpenModal("batch-move");
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
            >
              <Move className="w-4 h-4 text-emerald-500" />
              <span>
                {t("explorer.contextMenu.moveItemsCount", {
                  count: totalSelectedCount,
                })}
              </span>
            </button>
          </CanAll>

          <CanAll permissions={["song.delete", "folder.delete"]}>
            <button
              onClick={() => {
                onOpenModal("batch-delete");
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>
                {t("explorer.contextMenu.deleteItemsCount", {
                  count: totalSelectedCount,
                })}
              </span>
            </button>
          </CanAll>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

          <button
            onClick={() => {
              onClearSelection();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>{t("explorer.contextMenu.deselect")}</span>
          </button>
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 mb-0.5 truncate">
            {contextMenu.type === "folder"
              ? (contextMenu.item as Folder).name
              : (contextMenu.item as Song).title}
          </div>

          {contextMenu.type === "folder" ? (
            <>
              <button
                onClick={() => {
                  onSelectFolder((contextMenu.item as Folder).id);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>{t("explorer.contextMenu.openFolder")}</span>
              </button>

              <Can permission="folder.update">
                <button
                  onClick={() => {
                    onCustomizeFolder?.(contextMenu.item as Folder);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Palette className="w-4 h-4 text-purple-500" />
                  <span>{t("explorer.contextMenu.customizeFolder")}</span>
                </button>

                <button
                  onClick={() => {
                    onRenameFolder(contextMenu.item as Folder);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-sky-600" />
                  <span>{t("explorer.contextMenu.renameFolder")}</span>
                </button>

                <button
                  onClick={() => {
                    onMoveFolder(contextMenu.item as Folder);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Move className="w-4 h-4 text-emerald-500" />
                  <span>{t("explorer.contextMenu.moveFolder")}</span>
                </button>
              </Can>

              <Can permission="export.pdf">
                <button
                  onClick={() => {
                    onPrintFolder?.((contextMenu.item as Folder).id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-500" />
                  <span>{t("explorer.contextMenu.printFolder")}</span>
                </button>
              </Can>

              <Can permission="folder.delete">
                <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                <button
                  onClick={() => {
                    onDeleteFolder(contextMenu.item as Folder);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>{t("explorer.contextMenu.deleteFolder")}</span>
                </button>
              </Can>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  navigate(
                    `${slugPrefix}/songs/${(contextMenu.item as Song).id}`,
                  );
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-sky-600" />
                <span>{t("explorer.contextMenu.openEditSong")}</span>
              </button>
              <Can permission="song.update">
                <button
                  onClick={() => {
                    onMoveSong(contextMenu.item as Song);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                  <span>{t("explorer.contextMenu.moveSong")}</span>
                </button>

                {onAddToCollection && (
                  <button
                    onClick={() => {
                      onAddToCollection(contextMenu.item as Song);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-amber-500" />
                    <span>{t("explorer.contextMenu.addToCollection")}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onTagSong(contextMenu.item as Song);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-sky-600" />
                  <span>{t("explorer.contextMenu.tagSong")}</span>
                </button>
              </Can>
              <Can permission="export.pdf">
                <button
                  onClick={() => {
                    onPrintSong?.((contextMenu.item as Song).id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-500" />
                  <span>{t("explorer.contextMenu.printSong")}</span>
                </button>
              </Can>

              <Can permission="song.delete">
                <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                <button
                  onClick={() => {
                    onDeleteSong(contextMenu.item as Song);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>{t("explorer.contextMenu.deleteSong")}</span>
                </button>
              </Can>
            </>
          )}
        </>
      )}
    </div>
  );
};
