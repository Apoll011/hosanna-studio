import { Button, Spinner } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Folder, Song } from "@/src/types";
import { FolderOpen, Plus, Upload } from "lucide-react";
import React from "react";
import { useOutletContext } from "react-router-dom";
import {
  FolderGridCard,
  FolderTableRow,
  SongGridCard,
  SongTableRow,
} from "../components/explorer";
import { useAuth } from "../contexts/AuthContext";
import { useAppNavigate } from "../hooks/useAppNavigate";
import { usePersonalSettings } from "../hooks/usePersonalSettings";
import { Can, CanAll } from "../lib/permissions/components";

interface FolderExplorerContext {
  filteredSubfolders: Folder[];
  filteredFiles: Song[];
  viewMode: "grid" | "list";
  density?: "comfortable" | "compact";
  isSearchingOrFiltering: boolean;
  currentFolder: Folder | undefined;
  searchQuery: string;
  handleItemClick: (
    e: React.MouseEvent,
    id: string,
    type: "folder" | "song",
  ) => void;
  handleSelectFolder: (id: string | null) => void;
  handleContextMenu: (
    e: React.MouseEvent,
    type: "folder" | "song",
    item: Folder | Song,
  ) => void;
  getFolderPathString: (folderId: string | null | undefined) => string;
  selectedFolderIds: Set<string>;
  selectedSongIds: Set<string>;
  foldersQuery: { isLoading: boolean };
  songsQuery: { isLoading: boolean };
  setIsCreateSongModalOpen: (open: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  handleWorkspaceMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleCanvasContextMenu: (e: React.MouseEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  isDraggingOver: boolean;
  totalItemsCount: number;
  currentFolderId: string | null;
  selectionBox: { x: number; y: number; width: number; height: number } | null;

  /* Internal item drag & drop */
  isInternalDragActive: boolean;
  dropTargetFolderId: string | null;
  dragDisabledFolderIds: Set<string>;
  handleItemDragStart: (
    e: React.DragEvent,
    id: string,
    type: "folder" | "song",
  ) => void;
  handleItemDragEnd: () => void;
  handleFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  handleFolderDragLeave: (e: React.DragEvent, folderId: string) => void;
  handleFolderDrop: (e: React.DragEvent, folderId: string) => void;
}

const DEFAULT_CONTEXT: FolderExplorerContext = {
  filteredSubfolders: [],
  filteredFiles: [],
  viewMode: "grid",
  density: "comfortable",
  isSearchingOrFiltering: false,
  currentFolder: undefined,
  searchQuery: "",
  handleItemClick: () => {},
  handleSelectFolder: () => {},
  handleContextMenu: () => {},
  getFolderPathString: () => "",
  selectedFolderIds: new Set(),
  selectedSongIds: new Set(),
  foldersQuery: { isLoading: false },
  songsQuery: { isLoading: false },
  setIsCreateSongModalOpen: () => {},
  fileInputRef: { current: null },
  containerRef: { current: null },
  handleWorkspaceMouseDown: () => {},
  handleCanvasContextMenu: () => {},
  handleDragOver: () => {},
  handleDragLeave: () => {},
  handleDrop: () => {},
  isDraggingOver: false,
  totalItemsCount: 0,
  currentFolderId: null,
  selectionBox: null,
  isInternalDragActive: false,
  dropTargetFolderId: null,
  dragDisabledFolderIds: new Set(),
  handleItemDragStart: () => {},
  handleItemDragEnd: () => {},
  handleFolderDragOver: () => {},
  handleFolderDragLeave: () => {},
  handleFolderDrop: () => {},
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export const FoldersPage: React.FC = () => {
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
  const context = useOutletContext<FolderExplorerContext>() ?? DEFAULT_CONTEXT;
  const { organization } = useAuth();
  const { settings: personalSettings } = usePersonalSettings();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";

  const {
    filteredSubfolders,
    filteredFiles,
    viewMode,
    density = "comfortable",
    isSearchingOrFiltering,
    currentFolder,
    searchQuery,
    handleItemClick,
    handleSelectFolder,
    handleContextMenu,
    getFolderPathString,
    selectedFolderIds,
    selectedSongIds,
    foldersQuery,
    songsQuery,
    setIsCreateSongModalOpen,
    fileInputRef,
    containerRef,
    handleWorkspaceMouseDown,
    handleCanvasContextMenu,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDraggingOver,
    totalItemsCount,
    currentFolderId,
    isInternalDragActive,
    dropTargetFolderId,
    dragDisabledFolderIds,
    handleItemDragStart,
    handleItemDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
  } = context;

  const isCompact = density === "compact";

  return (
    <div
      ref={containerRef}
      onMouseDown={handleWorkspaceMouseDown}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 p-6 overflow-y-auto bg-m3-bg dark:bg-m3-bg relative transition-all select-none min-h-75 h-full ${
        isDraggingOver //TODO: Remove with the permission
          ? "ring-4 ring-inset ring-[#0284c7] bg-sky-50/50 dark:bg-sky-950/30"
          : ""
      }`}
    >
      {/* Drag Over Overlay (só para upload externo, nunca durante drag interno) */}
      {isDraggingOver && !isInternalDragActive && (
        <Can permission="song.import">
          <div className="absolute inset-0 bg-[#0284c7]/10 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            <div className="w-16 h-16 rounded-3xl bg-[#0284c7] text-white flex items-center justify-center shadow-lg mb-3 animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-[#0284c7]">
              {t("foldersPage.dropHere")}
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              {t("foldersPage.dropHereDesc", {
                folder: currentFolder
                  ? currentFolder.name
                  : t("layout.rootDirectory"),
              })}
            </p>
          </div>
        </Can>
      )}

      {foldersQuery.isLoading || songsQuery.isLoading ? (
        <div className="h-full flex items-center justify-center p-12">
          <Spinner label={t("foldersPage.loading")} />
        </div>
      ) : totalItemsCount === 0 ? (
        <div className="h-full flex flex-col items-center justify-center p-12 text-center my-8 select-none">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-center text-amber-500 mb-4">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {searchQuery
              ? t("foldersPage.noResults")
              : t("foldersPage.emptyTitle")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            {searchQuery
              ? t("foldersPage.noResultsDesc", {
                  folder: currentFolder ? currentFolder.name : t("common.root"),
                  query: searchQuery,
                })
              : currentFolderId === null
                ? t("foldersPage.emptyRootDesc")
                : t("foldersPage.emptyFolderDesc", {
                    folder: currentFolder?.name || "",
                  })}
          </p>

          {!searchQuery && (
            <div className="flex flex-col items-center gap-3 mt-6">
              <Can permission="song.create">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsCreateSongModalOpen(true)}
                >
                  {t("addressBar.newSong")}
                </Button>
              </Can>
              <CanAll permissions={["song.create", "song.import"]}>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {t("common.or")}
                </span>
              </CanAll>
              <Can permission="song.import">
                <button
                  onClick={() => fileInputRef?.current?.click()}
                  className="text-xs font-medium text-[#0284c7] hover:underline flex items-center gap-1.5 cursor-pointer bg-sky-50/80 dark:bg-sky-950/40 px-4 py-2 rounded-xl border border-sky-200 dark:border-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t("foldersPage.dragOrClick")}</span>
                </button>
              </Can>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div
          className={
            isCompact
              ? "grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5"
              : "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          }
        >
          {filteredSubfolders.map((folder) => (
            <FolderGridCard
              key={folder.id}
              folder={folder}
              isSelected={selectedFolderIds.has(folder.id)}
              isSearchingOrFiltering={isSearchingOrFiltering}
              isDropTarget={dropTargetFolderId === folder.id}
              isDropDisabled={dragDisabledFolderIds.has(folder.id)}
              isInternalDragActive={isInternalDragActive}
              getFolderPathString={getFolderPathString}
              density={density}
              onClick={(e) => handleItemClick(e, folder.id, "folder")}
              onDoubleClick={() => handleSelectFolder(folder.id)}
              onContextMenu={(e) => handleContextMenu(e, "folder", folder)}
              onDragStart={(e) => handleItemDragStart(e, folder.id, "folder")}
              onDragEnd={handleItemDragEnd}
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
            />
          ))}

          {filteredFiles.map((song) => (
            <SongGridCard
              key={song.id}
              song={song}
              isSelected={selectedSongIds.has(song.id)}
              isSearchingOrFiltering={isSearchingOrFiltering}
              getFolderPathString={getFolderPathString}
              density={density}
              showSongScore={personalSettings.showSongScore}
              songScoreLayout={personalSettings.songScoreLayout}
              onClick={(e) => handleItemClick(e, song.id, "song")}
              onDoubleClick={() => navigate(`${slugPrefix}/songs/${song.id}`)}
              onContextMenu={(e) => handleContextMenu(e, "song", song)}
              onDragStart={(e) => handleItemDragStart(e, song.id, "song")}
              onDragEnd={handleItemDragEnd}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse select-none">
            <thead>
              <tr className="bg-m3-sidebar/40 border-b border-m3-border text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em]">
                <th className={isCompact ? "py-2.5 px-4" : "py-4 px-6"}>
                  {t("common.name")}
                </th>
                <th className={isCompact ? "py-2.5 px-4" : "py-4 px-6"}>
                  {t("common.type")}
                </th>
                {isSearchingOrFiltering && (
                  <th className={isCompact ? "py-2.5 px-4" : "py-4 px-6"}>
                    {t("common.location")}
                  </th>
                )}
                <th className={isCompact ? "py-2.5 px-4" : "py-4 px-6"}>
                  {t("common.details")}
                </th>
                {personalSettings.showSongScore && (
                  <th className={isCompact ? "py-2.5 px-4" : "py-4 px-6"}>
                    Score
                  </th>
                )}
                <th
                  className={`${isCompact ? "py-2.5 px-4" : "py-4 px-6"} text-right`}
                >
                  {t("common.action")}
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-m3-border/30 ${isCompact ? "text-xs" : "text-[13px]"} font-bold`}
            >
              {filteredSubfolders.map((folder) => (
                <FolderTableRow
                  key={folder.id}
                  folder={folder}
                  isSelected={selectedFolderIds.has(folder.id)}
                  isSearchingOrFiltering={isSearchingOrFiltering}
                  isDropTarget={dropTargetFolderId === folder.id}
                  isDropDisabled={dragDisabledFolderIds.has(folder.id)}
                  isInternalDragActive={isInternalDragActive}
                  getFolderPathString={getFolderPathString}
                  density={density}
                  onClick={(e) => handleItemClick(e, folder.id, "folder")}
                  onDoubleClick={() => handleSelectFolder(folder.id)}
                  onContextMenu={(e) => handleContextMenu(e, "folder", folder)}
                  onDragStart={(e) =>
                    handleItemDragStart(e, folder.id, "folder")
                  }
                  onDragEnd={handleItemDragEnd}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                />
              ))}

              {filteredFiles.map((song) => (
                <SongTableRow
                  key={song.id}
                  song={song}
                  isSelected={selectedSongIds.has(song.id)}
                  isSearchingOrFiltering={isSearchingOrFiltering}
                  getFolderPathString={getFolderPathString}
                  density={density}
                  showSongScore={personalSettings.showSongScore}
                  songScoreLayout={personalSettings.songScoreLayout}
                  onClick={(e) => handleItemClick(e, song.id, "song")}
                  onDoubleClick={() =>
                    navigate(`${slugPrefix}/songs/${song.id}`)
                  }
                  onContextMenu={(e) => handleContextMenu(e, "song", song)}
                  onDragStart={(e) => handleItemDragStart(e, song.id, "song")}
                  onDragEnd={handleItemDragEnd}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
