import { SongScoreLayout } from "@/src/hooks/usePersonalSettings";
import { useI18n } from "@/src/lib/i18n";
import { Folder, Song } from "@/src/types";
import { FileMusicIcon, MoreVertical } from "lucide-react";
import React from "react";
import {
  getFolderColorStyle,
  getFolderIconComponent,
} from "../../utils/folderCustomization";
import { SongScoreVisualizer } from "./SongScoreVisualizer";

export interface FolderGridCardProps {
  folder: Folder;
  isSelected: boolean;
  isSearchingOrFiltering?: boolean;
  isDropTarget?: boolean;
  isDropDisabled?: boolean;
  isInternalDragActive?: boolean;
  getFolderPathString?: (folderId: string | null | undefined) => string;
  density?: "comfortable" | "compact";
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const FolderGridCard: React.FC<FolderGridCardProps> = React.memo(
  ({
    folder,
    isSelected,
    isSearchingOrFiltering,
    isDropTarget,
    isDropDisabled,
    isInternalDragActive,
    getFolderPathString,
    density = "comfortable",
    onClick,
    onDoubleClick,
    onContextMenu,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  }) => {
    const { t } = useI18n();
    const showDisabledDuringDrag = isInternalDragActive && isDropDisabled;
    const isCompact = density === "compact";

    return (
      <div
        data-item-id={folder.id}
        data-item-type="folder"
        draggable={Boolean(onDragStart)}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick(e);
        }}
        onContextMenu={onContextMenu}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`${isCompact ? "p-3.5 rounded-2xl" : "p-5 rounded-3xl"} border transition-all cursor-pointer flex flex-col items-center text-center group relative shadow-sm hover:shadow-xl active:scale-95 select-none ${
          isDropTarget && !isDropDisabled
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-4 ring-emerald-300/40 border-dashed shadow-lg scale-[1.02]"
            : isSelected
              ? "border-m3-primary bg-m3-primary/10 ring-4 ring-m3-primary/10 shadow-lg"
              : "border-m3-border/50 bg-m3-card hover:bg-m3-hover hover:border-m3-primary/40"
        } ${showDisabledDuringDrag ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          className={`absolute ${isCompact ? "top-2 right-2 p-1" : "top-3 right-3 p-1.5"} rounded-xl text-m3-secondary hover:text-m3-text hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all z-10 cursor-pointer ${
            isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          title={t("explorer.moreOptions")}
          aria-label={t("explorer.moreOptions")}
        >
          <MoreVertical className={isCompact ? "w-3.5 h-3.5" : "w-4.5 h-4.5"} />
        </button>

        {(() => {
          const IconComponent = getFolderIconComponent(folder.icon);
          const colorStyle = getFolderColorStyle(folder.color);
          return (
            <div
              className={`${isCompact ? "w-10 h-10 rounded-xl mb-2" : "w-14 h-14 rounded-2xl mb-3"} ${colorStyle.bgClass} border ${colorStyle.borderClass} flex items-center justify-center ${colorStyle.textClass} group-hover:scale-110 transition-transform`}
            >
              <IconComponent
                className={`${isCompact ? "w-5 h-5" : "w-8 h-8"} opacity-80`}
              />
            </div>
          );
        })()}

        <span
          className={`${isCompact ? "text-xs" : "text-sm"} font-black text-m3-text transition-colors truncate w-full px-1`}
        >
          {folder.name}
        </span>

        <span className="text-[10px] text-m3-secondary font-bold uppercase tracking-wider mt-0.5 opacity-70">
          {t("explorer.itemsCount", {
            count: (folder.songCount || 0) + (folder.folderCount || 0),
          })}
        </span>

        {isSearchingOrFiltering && getFolderPathString && (
          <span className="text-[10px] font-black text-m3-primary uppercase tracking-widest bg-m3-primary/10 px-2 py-0.5 rounded-lg mt-2 truncate max-w-full">
            {getFolderPathString(folder.parentId)}
          </span>
        )}
      </div>
    );
  },
);
FolderGridCard.displayName = "FolderGridCard";

export interface SongGridCardProps {
  song: Song;
  isSelected: boolean;
  isSearchingOrFiltering?: boolean;
  getFolderPathString?: (folderId: string | null | undefined) => string;
  density?: "comfortable" | "compact";
  /** Whether to show the song score visualizer */
  showSongScore?: boolean;
  /** Which layout to use for the score visualizer */
  songScoreLayout?: SongScoreLayout;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export const SongGridCard: React.FC<SongGridCardProps> = React.memo(
  ({
    song,
    isSelected,
    isSearchingOrFiltering,
    getFolderPathString,
    density = "comfortable",
    showSongScore = false,
    songScoreLayout = "ring",
    onClick,
    onDoubleClick,
    onContextMenu,
    onDragStart,
    onDragEnd,
  }) => {
    const { t } = useI18n();
    const isCompact = density === "compact";
    const scoreValue = (song as { score?: { score: number } }).score?.score;
    const hasScore = showSongScore && scoreValue !== undefined;

    return (
      <div
        data-item-id={song.id}
        data-item-type="song"
        draggable={Boolean(onDragStart)}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick(e);
        }}
        onContextMenu={onContextMenu}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`${isCompact ? "p-3.5 rounded-2xl" : "p-5 rounded-3xl"} border transition-all cursor-pointer flex flex-col items-center text-center group relative shadow-sm hover:shadow-xl active:scale-95 select-none ${
          isSelected
            ? "border-m3-primary bg-m3-primary/10 ring-4 ring-m3-primary/10 shadow-lg"
            : "border-m3-border/50 bg-m3-card hover:bg-m3-hover hover:border-m3-primary/40"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          className={`absolute ${isCompact ? "top-2 right-2 p-1" : "top-3 right-3 p-1.5"} rounded-xl text-m3-secondary hover:text-m3-text hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all z-10 cursor-pointer ${
            isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          title={t("explorer.moreOptions")}
          aria-label={t("explorer.moreOptions")}
        >
          <MoreVertical className={isCompact ? "w-3.5 h-3.5" : "w-4.5 h-4.5"} />
        </button>

        {song.song_number && (
          <span
            className={`absolute ${isCompact ? "top-2 left-2 text-[9px] px-1.5 py-0.5" : "top-5 left-5 text-[10px] px-2 py-1"} font-bold bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-slate-700`}
          >
            {t("explorer.songNumber", { number: song.song_number })}
          </span>
        )}

        {/* Icon box — ring layout overlays the score on the icon */}
        <div className="relative">
          <div
            className={`${isCompact ? "w-10 h-10 rounded-xl mb-2" : "w-14 h-14 rounded-2xl mb-3"} bg-m3-primary-light/20 border border-m3-primary/20 flex items-center justify-center text-m3-primary group-hover:scale-110 transition-transform`}
          >
            <FileMusicIcon
              className={`${isCompact ? "w-5 h-5" : "w-8 h-8"} opacity-80`}
            />
          </div>

          {/* Ring overlaid on the icon in the top-right corner */}
          {hasScore && songScoreLayout === "ring" && (
            <div
              className={`absolute ${isCompact ? "-top-1.5 -right-12" : "-top-1 -right-15"}`}
            >
              <SongScoreVisualizer
                score={scoreValue!}
                layout="ring"
                compact={isCompact}
              />
            </div>
          )}

          {/* Badge overlaid on the icon in the top-right corner */}
          {hasScore && songScoreLayout === "badge" && (
            <div
              className={`absolute ${isCompact ? "-top-3 -right-12" : "-top-1 -right-15"}`}
            >
              <SongScoreVisualizer
                score={scoreValue!}
                layout="badge"
                compact={isCompact}
              />
            </div>
          )}
        </div>

        <span
          className={`${isCompact ? "text-xs" : "text-sm"} font-black text-m3-text transition-colors truncate w-full px-1`}
        >
          {song.title}
        </span>

        <span className="text-[10px] text-m3-secondary font-bold truncate w-full px-1 mt-0.5 opacity-70">
          {song.artist || t("explorer.cifra")}
        </span>

        {/* Bar / dots rendered below the artist name, full width */}
        {hasScore &&
          (songScoreLayout === "bar" || songScoreLayout === "dots") && (
            <div className="w-full px-1">
              <SongScoreVisualizer
                score={scoreValue!}
                layout={songScoreLayout}
                compact={isCompact}
              />
            </div>
          )}

        {isSearchingOrFiltering && getFolderPathString && (
          <span className="text-[10px] font-black text-m3-secondary uppercase tracking-widest bg-m3-bg px-2 py-0.5 rounded-lg mt-2 truncate max-w-full border border-m3-border/50">
            {getFolderPathString(song.folderId)}
          </span>
        )}
      </div>
    );
  },
);
SongGridCard.displayName = "SongGridCard";
