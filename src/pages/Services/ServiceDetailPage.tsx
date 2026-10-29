/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChordProPreviewSettings } from "@/src/components/ChorproSettings";
import { Button, Input, Spinner } from "@/src/components/common";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useFolders } from "@/src/hooks/useFolders";
import { usePreviewSettings } from "@/src/hooks/usePreviewSettings";
import { TranslateFn, useI18n } from "@/src/lib/i18n";
import { ServiceElement, Song } from "@/src/types";
import { filterSearchableSongsWithLiqe } from "@/src/utils";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { ChordProRenderer, parseChordPro } from "@hosanna/chordpro";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Edit3,
  FileText,
  GripVertical,
  LayoutTemplate,
  Loader2,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings2,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePrint } from "../../contexts/PrintContext";
import { useSync } from "../../contexts/SyncContext";
import {
  AI_STAGE_SERVICE_EVENT,
  AiProposalBanner,
  aiContextBridge,
  type AiStageServiceDetail,
} from "../../features/ai-chat";
import { useOrgSettings } from "../../hooks/useOrgSettings";
import { useService, useServices } from "../../hooks/useServices";
import { useSearchableSongs, useSong, useSongs } from "../../hooks/useSongs";
import { AnnouncementModal } from "./modals/Anouncement";
import { ScriptureModal } from "./modals/Bible";
import { CustomModal } from "./modals/Custom";
import { MessageModal } from "./modals/Message";
import { WelcomeModal } from "./modals/Welcome";

function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array];  const [removed] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, removed);
  return newArray;
}

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const getElementBadge = (type: string, t: TranslateFn) => {
  switch (type.toLowerCase()) {
    case "song":
      return {
        label: t("serviceDetailPage.badgeSong"),
        bg: "#e0f2fe",
        color: "#5babdb",
        icon: Music,
      };
    case "welcome":
      return {
        label: t("serviceDetailPage.addWelcome"),
        bg: "#EBF5FF",
        color: "#1D4ED8",
        icon: FileText,
      };
    case "scripture":
      return {
        label: t("serviceDetailPage.addScripture"),
        bg: "#FDF4FF",
        color: "#C026D3",
        icon: BookOpen,
      };
    case "message":
      return {
        label: t("serviceDetailPage.addMessage"),
        bg: "#FEF3C7",
        color: "#D97706",
        icon: MessageSquare,
      };
    case "announcement":
      return {
        label: t("serviceDetailPage.addAnnouncement"),
        bg: "#ECFDF5",
        color: "#059669",
        icon: Megaphone,
      };
    default:
      return {
        label: type || t("serviceDetailPage.addCustom"),
        bg: "#F1F5F9",
        color: "#475569",
        icon: FileText,
      };
  }
};

const SongPreview: React.FC<{ element: ServiceElement; chrome?: boolean }> = ({
  element,
  chrome = true,
}) => {
  const { t } = useI18n();
  const { data: song, isLoading } = useSong(element.songId || null);
  const { settings, updateSetting, resetSettings } = usePreviewSettings();
  const [showSettings, setShowSettings] = useState(false);
  const deferredContent = useDeferredValue(song?.content || "");
  const transformedSong = useMemo(() => {
    let transformed = parseChordPro(deferredContent || song?.content || "")
      .transpose(settings.transposeVal)
      .instrument(settings.instrument);
    if (!settings.showChords) transformed = transformed.removeChords(true);
    return transformed;
  }, [
    deferredContent,
    song?.content,
    settings.instrument,
    settings.showChords,
    settings.transposeVal,
  ]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="md" />
      </div>
    );
  if (!song)
    return (
      <div className="flex items-center justify-center h-full text-sm text-m3-danger font-medium">
        {t("serviceDetailPage.songNotFound")}
      </div>
    );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {chrome && (
        <>
          <div className="h-10 bg-m3-sidebar/50 border-b border-m3-border dark:border-m3-dark-border flex items-center justify-between px-3 shrink-0">
            <span className="text-label flex items-center gap-1.5">
              <LayoutTemplate className="w-3 h-3" />{" "}
              {t("serviceDetailPage.previewTitle")}
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded transition-colors cursor-pointer ${showSettings ? "bg-m3-primary/10 text-m3-primary" : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"}`}
              title={t("serviceDetailPage.readingSettings")}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showSettings && (
            <ChordProPreviewSettings
              settings={settings}
              updateSetting={updateSetting}
              resetSettings={resetSettings}
              capo={transformedSong.metadata.capo}
            />
          )}
        </>
      )}

      <div
        className="hosanna-sheet flex-1 min-h-0 overflow-y-auto overscroll-contain bg-m3-card relative custom-scrollbar p-2"
        onClick={() => showSettings && setShowSettings(false)}
      >
        <ChordProRenderer
          song={transformedSong}
          fontSize={settings.fontSize}
          showDiagrams={settings.showDiagrams}
        />
      </div>
    </div>
  );
};

interface LibrarySongItemProps {
  song: { id: string; title: string; artist?: string };
  countInService: number;
  isPending: boolean;
  onAdd: (songId: string) => void;
}

const LibrarySongItem: React.FC<LibrarySongItemProps> = ({
  song,
  countInService,
  isPending,
  onAdd,
}) => {
  const { t } = useI18n();
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({
        type: "library-song",
        songId: song.id,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [song.id]);

  return (
    <div
      ref={itemRef}
      className={`flex items-center justify-between gap-3 px-3 py-2 min-h-14 bg-transparent hover:bg-m3-hover cursor-grab active:cursor-grabbing transition-colors ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate text-m3-text">
          {song.title}
        </p>
        <p className="text-xs text-m3-secondary truncate">
          {song.artist || "—"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {countInService > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            {t("serviceDetailPage.inService", { count: countInService })}
          </span>
        )}
        <button
          type="button"
          onClick={() => onAdd(song.id)}
          disabled={isPending}
          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 disabled:opacity-50 transition-colors cursor-pointer"
          aria-label={t("serviceDetailPage.addSong")}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

interface ServiceRowProps {
  element: ServiceElement;
  index: number;
  isPreviewed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTogglePreview: (el: ServiceElement) => void;
  onRemove: (id: string) => void;
  onEdit: (el: ServiceElement) => void;
  onNoteChange: (id: string, note: string) => void;
  onRestoreSong?: (songId: string) => Promise<void>;
  showNotes?: boolean;
}

const SERVICE_MENU_ITEM =
  "w-full flex items-center gap-2.5 px-3 py-2 min-h-10 rounded-[var(--radius-md)] text-m3-text hover:bg-m3-hover font-medium transition-colors text-left cursor-pointer";
const SERVICE_MENU_DANGER =
  "w-full flex items-center gap-2.5 px-3 py-2 min-h-10 rounded-[var(--radius-md)] text-m3-danger hover:bg-m3-danger/10 font-semibold transition-colors text-left cursor-pointer";
const SERVICE_MENU_ICON = "w-4 h-4 text-m3-secondary shrink-0";

const ServiceRow: React.FC<ServiceRowProps> = ({
  element,
  index,
  isPreviewed,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onTogglePreview,
  onRemove,
  onEdit,
  onNoteChange,
  onRestoreSong,
  showNotes = true,
}) => {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Detect whether the song linked to this row still exists (not deleted/purged).
  const isSong = element.type === "song";
  const { data: linkedSong, isLoading: isSongLoading } = useSong(
    isSong ? (element.songId ?? null) : null,
  );
  const isSongMissing = isSong && !isSongLoading && !linkedSong;

  useEffect(() => {
    const rowEl = rowRef.current;
    const handleEl = dragHandleRef.current;
    if (!rowEl || !handleEl) return;

    const cleanupDraggable = draggable({
      element: rowEl,
      dragHandle: handleEl,
      getInitialData: () => ({
        type: "service-element",
        elementId: element.id,
        index,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => {
        setIsDragging(false);
        setClosestEdge(null);
      },
    });

    const cleanupDropTarget = dropTargetForElements({
      element: rowEl,
      getData: ({ input, element: targetEl }) => {
        const data = {
          type: "service-element",
          elementId: element.id,
          index,
        };
        return attachClosestEdge(data, {
          input,
          element: targetEl,
          allowedEdges: ["top", "bottom"],
        });
      },
      canDrop: ({ source }) => {
        return (
          source.data.type === "library-song" ||
          (source.data.type === "service-element" &&
            source.data.elementId !== element.id)
        );
      },
      onDragEnter: (args) => {
        const edge = extractClosestEdge(args.self.data);
        setClosestEdge(edge);
      },
      onDrag: (args) => {
        const edge = extractClosestEdge(args.self.data);
        setClosestEdge(edge);
      },
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [element.id, index]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(element.notes || "");
  useEffect(() => setLocalNote(element.notes || ""), [element.notes]);

  const badge = getElementBadge(element.type, t);
  const Icon = badge.icon;

  const handleExpandToggle = () => {
    onTogglePreview(element);
  };

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = 196;
    if (rect) {
      const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
      );
      const below = rect.bottom + 4;
      const top =
        below + menuHeight > window.innerHeight
          ? Math.max(8, rect.top - menuHeight - 4)
          : below;
      setMenuPos({ top, left });
    }
    setMenuOpen(true);
  };

  const notesOpen = isExpanded && (isEditingNote || Boolean(element.notes));

  return (
    <div
      ref={rowRef}
      className={`bg-m3-card transition-colors relative ${
        isDragging ? "opacity-40" : "opacity-100"
      } ${isPreviewed ? "bg-m3-primary/5" : "hover:bg-m3-hover/50"} ${
        closestEdge === "top"
          ? "shadow-[inset_0_2px_0_var(--m3-primary)]"
          : closestEdge === "bottom"
            ? "shadow-[inset_0_-2px_0_var(--m3-primary)]"
            : ""
      } flex flex-col`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          ref={dragHandleRef}
          type="button"
          className="text-m3-secondary hover:text-m3-secondary cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-m3-hover touch-none"
          title={t("serviceDetailPage.dragToReorder")}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="text-xs font-semibold text-m3-secondary w-5 shrink-0 text-center tabular-nums">
          {index + 1}
        </span>

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div
          className="min-w-0 flex-1 cursor-pointer select-none"
          onClick={handleExpandToggle}
        >
          <p className="text-sm font-semibold truncate text-m3-text">
            {element.title || t("serviceDetailPage.untitledElement")}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
            {Number(element.duration || 0) > 0 && (
              <span className="text-[10px] font-semibold text-m3-secondary shrink-0 tabular-nums">
                {formatDuration(Number(element.duration || 0))}
              </span>
            )}
          </div>
          {element.passage && (
            <p className="text-xs text-m3-secondary font-medium truncate mt-0.5">
              {element.passage}
            </p>
          )}
          {element.content && !isSong && (
            <p className="text-xs text-m3-secondary line-clamp-1 mt-0.5">
              {element.content}
            </p>
          )}
          {showNotes && (isEditingNote || element.notes) && (
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <StickyNote className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
              <span className="text-xs italic text-amber-700 dark:text-amber-300/90 truncate">
                {element.notes}
              </span>
            </div>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 rounded text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 disabled:opacity-30 disabled:hover:text-m3-secondary disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={t("serviceDetailPage.moveUp")}
            aria-label={t("serviceDetailPage.moveUp")}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 rounded text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 disabled:opacity-30 disabled:hover:text-m3-secondary disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={t("serviceDetailPage.moveDown")}
            aria-label={t("serviceDetailPage.moveDown")}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleExpandToggle}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isPreviewed ? "bg-m3-primary/10 text-m3-primary" : "text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10"}`}
            title={
              isPreviewed
                ? t("serviceDetailPage.closePreview")
                : t("serviceDetailPage.openPreview")
            }
          >
            {isPreviewed ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>

          <div className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              className="min-h-10 min-w-10 inline-flex items-center justify-center text-m3-secondary hover:text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer"
              aria-label={t("explorer.moreOptions")}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && menuPos && (
              <>
                <div
                  className="fixed inset-0 z-[70]"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  style={{ top: menuPos.top, left: menuPos.left }}
                  className="fixed z-[80] w-56 bg-m3-card border border-m3-border rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-1.5 flex flex-col gap-0.5 text-xs select-none hosanna-enter"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-label text-m3-secondary border-b border-m3-border mb-0.5 truncate">
                    {element.title || t("serviceDetailPage.untitledElement")}
                  </div>
                  {!isSong && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onEdit(element);
                        setMenuOpen(false);
                      }}
                      className={SERVICE_MENU_ITEM}
                    >
                      <Edit3 className={SERVICE_MENU_ICON} />
                      <span>{t("serviceDetailPage.editElement")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsEditingNote(true);
                      setIsExpanded(true);
                      setMenuOpen(false);
                    }}
                    className={SERVICE_MENU_ITEM}
                  >
                    <FileText className={SERVICE_MENU_ICON} />
                    <span>
                      {element.notes
                        ? t("serviceDetailPage.editNotes")
                        : t("serviceDetailPage.addNotes")}
                    </span>
                  </button>
                  {isSongMissing && onRestoreSong && element.songId && (
                    <>
                      <div className="my-1 border-t border-m3-border" />
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isRestoring}
                        onClick={async () => {
                          if (!element.songId) return;
                          setMenuOpen(false);
                          setIsRestoring(true);
                          try {
                            await onRestoreSong(element.songId);
                          } finally {
                            setIsRestoring(false);
                          }
                        }}
                        className={SERVICE_MENU_ITEM}
                      >
                        {isRestoring ? (
                          <Loader2
                            className={SERVICE_MENU_ICON + " animate-spin"}
                          />
                        ) : (
                          <RotateCcw className={SERVICE_MENU_ICON} />
                        )}
                        <span>{t("serviceDetailPage.restoreSong")}</span>
                      </button>
                    </>
                  )}
                  <div className="my-1 border-t border-m3-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onRemove(element.id);
                      setMenuOpen(false);
                    }}
                    className={SERVICE_MENU_DANGER}
                  >
                    <Trash2 className="w-4 h-4 text-m3-danger shrink-0" />
                    <span>{t("serviceDetailPage.removeElement")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Deleted-song warning banner */}
      {isSongMissing && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/40">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
              {t("serviceDetailPage.songDeletedHint")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onRestoreSong && element.songId && (
              <button
                type="button"
                disabled={isRestoring}
                onClick={async () => {
                  if (!element.songId) return;
                  setIsRestoring(true);
                  try {
                    await onRestoreSong(element.songId);
                  } finally {
                    setIsRestoring(false);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {isRestoring ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                {t("serviceDetailPage.restoreSong")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(element.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-m3-danger/10 text-m3-danger hover:bg-m3-danger/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              {t("serviceDetailPage.removeFromPlan")}
            </button>
          </div>
        </div>
      )}

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          notesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-m3-border dark:border-m3-border/30 bg-m3-sidebar/10 dark:bg-black/10 p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-label flex items-center gap-1">
                <FileText className="w-3 h-3" />{" "}
                {t("serviceDetailPage.elementNotes")}
              </label>
              {isEditingNote ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localNote}
                    onChange={(e) => setLocalNote(e.target.value)}
                    placeholder={t("serviceDetailPage.elementNotesPlaceholder")}
                    className="flex-1 text-xs rounded-lg border border-m3-border px-3 py-2 bg-m3-card focus:outline-none focus:border-m3-primary text-m3-text"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onNoteChange(element.id, localNote);
                      setIsEditingNote(false);
                      setIsExpanded(false);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                element.notes && (
                  <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    {element.notes}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type ModalType =
  "welcome" | "scripture" | "message" | "announcement" | "custom" | null;

const ReadingStage: React.FC<{
  elements: ServiceElement[];
  activeId: string | null;
  onSelect: (el: ServiceElement) => void;
}> = ({ elements, activeId, onSelect }) => {
  const { t } = useI18n();
  const activeIndex = Math.max(
    0,
    elements.findIndex((el) => el.id === activeId),
  );
  const current = elements[activeIndex];
  const next = elements[activeIndex + 1];

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-muted">{t("serviceDetailPage.readingEmpty")}</p>
      </div>
    );
  }

  const badge = getElementBadge(current.type, t);

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 bg-m3-card">
      <div className="md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-m3-border bg-m3-sidebar/30 flex flex-col min-h-0 max-h-36 md:max-h-none md:h-full">
        <div className="hidden md:flex items-center justify-between px-4 h-11 border-b border-m3-border shrink-0">
          <span className="text-label">
            {t("serviceDetailPage.serviceOrder")}
          </span>
          <span className="text-caption">
            {t("serviceDetailPage.readingKeys")}
          </span>
        </div>
        <div
          className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto min-h-0 flex-1 p-2 custom-scrollbar"
          role="listbox"
          aria-label={t("serviceDetailPage.serviceOrder")}
        >
          {elements.map((el, i) => {
            const selected = el.id === current.id;
            return (
              <button
                key={el.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(el)}
                className={`shrink-0 md:w-full text-left rounded-md px-3 min-h-11 cursor-pointer transition-colors flex items-center gap-2 ${
                  selected
                    ? "bg-m3-primary/10 text-m3-primary"
                    : "text-m3-text hover:bg-m3-hover"
                }`}
              >
                <span className="text-[11px] font-semibold tabular-nums text-m3-secondary w-4 shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold truncate">
                  {el.title || t("serviceDetailPage.untitledElement")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="px-4 sm:px-6 py-3 border-b border-m3-border flex items-end justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <p className="text-caption">
              {t("serviceDetailPage.nowLabel")} · {badge.label}
            </p>
            <h2 className="text-title truncate">{current.title}</h2>
          </div>
          {next && (
            <p className="text-caption shrink-0 max-w-[46%] text-right truncate">
              <span className="font-semibold text-m3-text">
                {t("serviceDetailPage.nextLabel")}
              </span>
              {" · "}
              {next.title}
            </p>
          )}
        </div>
        {current.notes && (
          <p className="px-4 sm:px-6 py-2 text-sm text-m3-text bg-m3-warning/10 border-b border-m3-warning/20 shrink-0">
            {current.notes}
          </p>
        )}
        <div className="flex-1 min-h-0 overflow-hidden overscroll-contain">
          {current.type === "song" ? (
            <SongPreview element={current} chrome={false} />
          ) : (
            <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-10 py-8 custom-scrollbar">
              {current.passage && (
                <p className="text-sm font-semibold text-m3-primary mb-4">
                  {current.passage}
                </p>
              )}
              <div className="font-lyric text-[1.35rem] sm:text-[1.6rem] leading-snug text-m3-text whitespace-pre-wrap max-w-2xl">
                {current.content || t("serviceDetailPage.noContent")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ServiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: service, isLoading, isError } = useService(id || null);
  const { updateElements, updateService } = useServices();
  const { songsQuery, restoreSong } = useSongs();
  const { foldersQuery } = useFolders();
  const { showToast, syncStatus } = useSync();
  const { settings: orgSettings } = useOrgSettings();
  const { printService } = usePrint();

  const [elements, setElements] = useState<ServiceElement[]>([]);
  const elementsRef = useRef<ServiceElement[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [stagedProposal, setStagedProposal] =
    useState<AiStageServiceDetail | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [pendingSongIds, setPendingSongIds] = useState<Record<string, number>>(
    {},
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showLibrary, setShowLibrary] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true,
  );
  const [mobilePane, setMobilePane] = useState<"order" | "library">("order");
  const [readingMode, setReadingMode] = useState(false);
  const readingRoleApplied = useRef(false);
  const [previewElement, setPreviewElement] = useState<ServiceElement | null>(
    null,
  );
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const dropContainerRef = useRef<HTMLDivElement>(null);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingElement, setEditingElement] = useState<ServiceElement | null>(
    null,
  );

  const allFolders = useMemo(
    () => foldersQuery.data?.folders || [],
    [foldersQuery.data?.folders],
  );

  const allSongs = useMemo(
    () => songsQuery.data?.songs || [],
    [songsQuery.data?.songs],
  );

  const { searchableSongs } = useSearchableSongs(allFolders);

  const [isEditingGeneralNotes, setIsEditingGeneralNotes] = useState(false);

  const appliedUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!service) return;
    // While a modal is open, keep remote service updates queued — applying them
    // would wipe local form state via parent re-renders / stale element sync.
    if (activeModal) return;
    if (service.updatedAt === appliedUpdatedAtRef.current) return;
    appliedUpdatedAtRef.current = service.updatedAt;

    if (!isEditingGeneralNotes) {
      setGeneralNotes(service.notes || "");
    }

    const sortedElements = [...(service.elements || [])].sort(
      (a, b) => (a.position || 0) - (b.position || 0),
    );
    setElements(sortedElements);
    elementsRef.current = sortedElements;
  }, [service, activeModal, isEditingGeneralNotes]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    if (!service) {
      aiContextBridge.setService(null);
      return;
    }
    aiContextBridge.setService({
      serviceId: service.id,
      title: service.name,
      elements,
      updatedAt: service.updatedAt,
      notes: generalNotes,
      date:
        typeof service.date === "string"
          ? service.date
          : service.date
            ? new Date(service.date).toISOString()
            : undefined,
    });
    return () => {
      aiContextBridge.setService(null);
    };
  }, [service, elements, generalNotes]);

  useEffect(() => {
    const onStage = (event: Event) => {
      const detail = (event as CustomEvent<AiStageServiceDetail>).detail;
      if (!detail?.elements) return;
      if (detail.serviceId && service && detail.serviceId !== service.id) return;
      setStagedProposal(detail);
    };
    window.addEventListener(AI_STAGE_SERVICE_EVENT, onStage);
    return () => window.removeEventListener(AI_STAGE_SERVICE_EVENT, onStage);
  }, [service]);

  const acceptStagedProposal = () => {
    if (!stagedProposal?.elements) return;
    const next = stagedProposal.elements.map((el, index) => ({
      ...el,
      position: el.position ?? index,
    }));
    setElements(next);
    elementsRef.current = next;
    if (stagedProposal.notes != null) setGeneralNotes(stagedProposal.notes);
    setStagedProposal(null);
    showToast(t("ai.chat.appliedToEditor"), "success");
  };

  const declineStagedProposal = () => {
    setStagedProposal(null);
  };

  // Auto-save general notes after a short debounce when the org autoSave is on
  useEffect(() => {
    if (!orgSettings.services.autoSave || !service || isEditingGeneralNotes)
      return;
    const timer = setTimeout(async () => {
      if (generalNotes === (service.notes || "")) return;
      try {
        await updateService({
          id: service.id,
          data: {
            name: service.name,
            notes: generalNotes,
            updatedAt: service.updatedAt,
          },
        });
      } catch {
        // silent — user can still save manually
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    generalNotes,
    orgSettings.services.autoSave,
    service,
    isEditingGeneralNotes,
    updateService,
  ]);

  // Close the preview if the song it references is removed from the plan
  useEffect(() => {
    if (previewElement && !elements.some((e) => e.id === previewElement.id)) {
      setPreviewElement(null);
    }
  }, [elements, previewElement]);

  // Derived state
  const allAvailableSongs = songsQuery.data?.songs || [];
  const songCountById = elements.reduce<Record<string, number>>((acc, el) => {
    if (el.type === "song" && el.songId)
      acc[el.songId] = (acc[el.songId] || 0) + 1;
    return acc;
  }, {});

  const totalDurationSeconds = elements.reduce(
    (acc, el) => acc + Math.max(0, Number(el.duration || 0)),
    0,
  );

  const filteredLibrarySongs = useMemo(() => {
    let list: Song[];

    let matchedSongIds: Set<string> | null = null;
    if (librarySearch.trim()) {
      const liqeMatches = filterSearchableSongsWithLiqe(
        searchableSongs,
        librarySearch,
      );
      matchedSongIds = new Set(liqeMatches.map((s) => s.id));
    }

    list = allSongs.filter((s) => {
      if (matchedSongIds !== null && !matchedSongIds.has(s.id)) {
        return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      let valA = (a.title || "").toLowerCase();
      let valB = (b.title || "").toLowerCase();

      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });
  }, [searchableSongs, allSongs, librarySearch]);

  const syncStatusMeta = {
    synced: { dot: "bg-emerald-500", label: t("misc.syncStatus.synced") },
    syncing: {
      dot: "bg-m3-primary animate-pulse",
      label: t("misc.syncStatus.syncing"),
    },
    error: { dot: "bg-rose-500", label: t("misc.syncStatus.error") },
    offline: { dot: "bg-amber-500", label: t("misc.syncStatus.offline") },
    local_only: {
      dot: "bg-m3-secondary",
      label: t("misc.syncStatus.local_only"),
    },
  } as const;
  const syncMeta = syncStatusMeta[syncStatus] ?? syncStatusMeta.local_only;

  const handleOpenLibrary = () => {
    setReadingMode(false);
    setShowLibrary(true);
    setMobilePane("library");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  useEffect(() => {
    if (readingRoleApplied.current || !user?.role) return;
    readingRoleApplied.current = true;
    if (user.role === "musician") setReadingMode(true);
  }, [user?.role]);

  const enterReadingMode = () => {
    setReadingMode(true);
    setMobilePane("order");
    setPreviewElement((prev) => prev ?? elementsRef.current[0] ?? null);
  };

  useEffect(() => {
    if (!readingMode) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft"
      ) {
        return;
      }
      const list = elementsRef.current;
      if (!list.length) return;
      event.preventDefault();
      const currentIndex = list.findIndex((el) => el.id === previewElement?.id);
      const index = currentIndex < 0 ? 0 : currentIndex;
      const delta =
        event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next = list[Math.min(list.length - 1, Math.max(0, index + delta))];
      if (next) setPreviewElement(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readingMode, previewElement]);

  const handleTogglePreview = (el: ServiceElement) => {
    setPreviewElement((prev) => (prev?.id === el.id ? null : el));
  };

  // Keep the last previewed song mounted during the close animation
  const previewContentRef = useRef<ServiceElement | null>(null);
  useEffect(() => {
    if (previewElement) previewContentRef.current = previewElement;
  }, [previewElement]);
  const previewContent = previewElement ?? previewContentRef.current;

  const [isSavingService, setIsSavingService] = useState(false);

  const syncElements = async (
    newElements: ServiceElement[],
    fallbackElements: ServiceElement[] = elementsRef.current,
  ) => {
    if (!service) return;
    const updated = newElements.map((e, index) => ({ ...e, position: index }));
    setElements(updated);
    elementsRef.current = updated;

    if (orgSettings.services.autoSave) {
      try {
        await updateElements({
          serviceId: service.id,
          data: { elements: updated, updatedAt: service.updatedAt },
        });
      } catch (error) {
        setElements(fallbackElements);
        elementsRef.current = fallbackElements;
        throw error;
      }
    }
  };

  const handleSaveEntireService = async () => {
    if (!service) return;
    setIsSavingService(true);
    try {
      await updateService({
        id: service.id,
        data: {
          name: service.name,
          elements: elementsRef.current,
          notes: generalNotes,
          updatedAt: service.updatedAt,
        },
      });
      showToast(t("serviceDetailPage.serviceSavedSuccess"), "success");
    } catch (error) {
      showToast(
        t("serviceDetailPage.serviceSaveError", {
          error:
            (error as { message?: string | null })?.message || "Save error",
        }),
        "error",
      );
    } finally {
      setIsSavingService(false);
    }
  };

  const handleRemoveElement = async (elementId: string) => {
    await syncElements(elementsRef.current.filter((e) => e.id !== elementId));
  };

  const handleMoveElement = async (elementId: string, direction: -1 | 1) => {
    const current = elementsRef.current;
    const oldIndex = current.findIndex((e) => e.id === elementId);
    if (oldIndex === -1) return;
    const newIndex = oldIndex + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    await syncElements(arrayMove(current, oldIndex, newIndex));
  };

  const handleNoteChange = async (elementId: string, note: string) => {
    await syncElements(
      elementsRef.current.map((e) =>
        e.id === elementId ? { ...e, notes: note } : e,
      ),
    );
  };

  const handleSaveGeneralNotes = async () => {
    if (!service) return;
    if (orgSettings.services.autoSave) {
      try {
        await updateService({
          id: service.id,
          data: {
            name: service.name,
            notes: generalNotes,
            updatedAt: service.updatedAt,
          },
        });
        showToast(t("serviceDetailPage.serviceSavedSuccess"), "success");
      } catch (error) {
        showToast(
          t("serviceDetailPage.serviceSaveError", {
            error:
              (error as { message?: string | null })?.message || "Sync error",
          }),
          "error",
        );
      }
    }
  };

  const handleAddSongToService = async (
    songId: string,
    insertBeforeElementId?: string,
  ) => {
    setPendingSongIds((prev) => ({
      ...prev,
      [songId]: (prev[songId] || 0) + 1,
    }));
    const previousElements = [...elementsRef.current];
    try {
      const song = allAvailableSongs.find((s) => s.id === songId);

      const parsed = parseChordPro(song?.content || "");
      const newElem: ServiceElement = {
        id: crypto.randomUUID(),
        type: "song",
        title: song?.title || t("serviceDetailPage.unknownSong"),
        songId,
        content: song?.artist || t("serviceDetailPage.noComposer"),
        position: previousElements.length,
        duration:
          Number(parsed.metadata.duration || "0") ||
          orgSettings.services.songDuration,
      };

      const nextElements = [...previousElements];
      if (insertBeforeElementId) {
        const idx = nextElements.findIndex(
          (e) => e.id === insertBeforeElementId,
        );
        if (idx !== -1) nextElements.splice(idx, 0, newElem);
        else nextElements.push(newElem);
      } else {
        nextElements.push(newElem);
      }
      await syncElements(nextElements, previousElements);
    } catch {
      showToast(t("serviceDetailPage.failedToLoadSong"), "error");
    } finally {
      setPendingSongIds((prev) => {
        const next = { ...prev };
        if ((next[songId] || 0) > 1) next[songId] -= 1;
        else delete next[songId];
        return next;
      });
    }
  };

  const handleModalSave = async (
    type: string,
    data: {
      title: string;
      content?: string;
      passage?: string;
      notes?: string;
      duration?: number;
    },
  ) => {
    const previousElements = [...elementsRef.current];
    let nextElements = [...previousElements];
    if (editingElement) {
      nextElements = nextElements.map((e) =>
        e.id === editingElement.id
          ? {
              ...e,
              title: data.title,
              content: data.content || "",
              passage: data.passage || "",
              notes: data.notes || "",
              duration: data.duration ?? Number(e.duration || 0),
            }
          : e,
      );
    } else {
      nextElements.push({
        id: crypto.randomUUID(),
        type: type as ServiceElement["type"],
        title: data.title,
        content: data.content || "",
        passage: data.passage || "",
        notes: data.notes || "",
        position: previousElements.length,
        duration: data.duration || 0,
      });
    }
    try {
      await syncElements(nextElements, previousElements);
      setActiveModal(null);
      setEditingElement(null);
    } catch {
      showToast(
        t("serviceDetailPage.serviceSaveError", { error: "Save error" }),
        "error",
      );
    }
  };

  const openAddModal = (type: ModalType) => {
    setEditingElement(null);
    setActiveModal(type);
  };

  const openEditModal = (element: ServiceElement) => {
    setEditingElement(element);
    const knownTypes: ModalType[] = [
      "welcome",
      "scripture",
      "message",
      "announcement",
      "custom",
    ];
    setActiveModal(
      knownTypes.includes(element.type as ModalType)
        ? (element.type as ModalType)
        : "custom",
    );
  };

  // Pragmatic DnD drop target for the entire elements container
  useEffect(() => {
    const el = dropContainerRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === "library-song",
      onDragEnter: () => setIsDropTargetActive(true),
      onDragLeave: () => setIsDropTargetActive(false),
      onDrop: () => setIsDropTargetActive(false),
    });
  }, []);

  const syncElementsRef = useRef(syncElements);
  syncElementsRef.current = syncElements;
  const handleAddSongToServiceRef = useRef(handleAddSongToService);
  handleAddSongToServiceRef.current = handleAddSongToService;

  // Monitor all pragmatic drag-and-drop operations
  useEffect(() => {
    return monitorForElements({
      onDrop: async ({ source, location }) => {
        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const currentElements = elementsRef.current;

        // Case 1: Reordering service elements within the list
        if (source.data.type === "service-element") {
          const sourceId = source.data.elementId as string;
          const targetData = destination.data;

          if (targetData.type === "service-element") {
            const targetId = targetData.elementId as string;
            if (sourceId === targetId) return;

            const oldIndex = currentElements.findIndex(
              (e) => e.id === sourceId,
            );
            const targetIndex = currentElements.findIndex(
              (e) => e.id === targetId,
            );
            if (oldIndex === -1 || targetIndex === -1) return;

            const edge = extractClosestEdge(targetData);
            let newIndex = targetIndex;
            if (edge === "bottom" && oldIndex > targetIndex) {
              newIndex = targetIndex + 1;
            } else if (edge === "top" && oldIndex < targetIndex) {
              newIndex = targetIndex - 1;
            }

            const reordered = arrayMove(
              currentElements,
              oldIndex,
              Math.max(0, Math.min(newIndex, currentElements.length - 1)),
            );
            await syncElementsRef.current(reordered);
          }
          return;
        }

        // Case 2: Dropping a song from the library
        if (source.data.type === "library-song") {
          const songId = source.data.songId as string;
          if (!songId) return;

          const targetData = destination.data;
          let insertBeforeId: string | undefined = undefined;

          if (targetData.type === "service-element") {
            const targetId = targetData.elementId as string;
            const edge = extractClosestEdge(targetData);
            if (edge === "top") {
              insertBeforeId = targetId;
            } else {
              const targetIndex = currentElements.findIndex(
                (e) => e.id === targetId,
              );
              if (
                targetIndex !== -1 &&
                targetIndex + 1 < currentElements.length
              ) {
                insertBeforeId = currentElements[targetIndex + 1].id;
              }
            }
          }

          await handleAddSongToServiceRef.current(songId, insertBeforeId);
        }
      },
    });
  }, []);

  const editInitial = useMemo(
    () =>
      editingElement
        ? {
            title: editingElement.title,
            content: editingElement.content || "",
            passage: editingElement.passage || "",
            notes: editingElement.notes || "",
            duration: Number(editingElement.duration || 0),
          }
        : undefined,
    [editingElement],
  );

  // When creating new elements, pre-fill duration from org defaults
  const newMessageInitial = useMemo(
    () =>
      editInitial ?? {
        title: "",
        content: "",
        passage: "",
        notes: "",
        duration: orgSettings.services.sermonDuration,
      },
    [editInitial, orgSettings.services.sermonDuration],
  );
  const newGenericInitial = useMemo(
    () =>
      editInitial ?? {
        title: "",
        content: "",
        passage: "",
        notes: "",
        duration: orgSettings.services.songDuration,
      },
    [editInitial, orgSettings.services.songDuration],
  );

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Spinner size="lg" label={t("serviceDetailPage.loadingPlan")} />
      </div>
    );
  if (isError || !service)
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
        <h2 className="text-lg font-bold text-m3-text">
          {t("serviceDetailPage.serviceNotFound")}
        </h2>
        <Button
          variant="primary"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(-1)}
        >
          {t("common.back")}
        </Button>
      </div>
    );

  return (
    <div
      data-tour="service-builder"
      className="flex-1 flex flex-col h-full overflow-hidden bg-m3-sidebar/10 relative"
    >
      {stagedProposal && (
        <AiProposalBanner
          title={stagedProposal.name || service.name}
          onAccept={acceptStagedProposal}
          onDecline={declineStagedProposal}
        />
      )}
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="h-14 bg-m3-sidebar border-b border-m3-border flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-m3-text flex items-center gap-2">
              {service.name}
            </h1>
            <p className="text-[10px] text-m3-secondary">
              {t("serviceDetailPage.servicePlan")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-md border border-m3-border bg-m3-card p-0.5"
            role="group"
            aria-label={t("serviceDetailPage.readingModeHint")}
          >
            <button
              type="button"
              onClick={() => {
                setReadingMode(false);
                setPreviewElement(null);
              }}
              className={`min-h-8 px-2.5 text-xs font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
                readingMode
                  ? "text-m3-secondary hover:text-m3-text"
                  : "bg-m3-primary text-white"
              }`}
              aria-pressed={!readingMode}
            >
              {t("serviceDetailPage.planMode")}
            </button>
            <button
              type="button"
              onClick={enterReadingMode}
              className={`min-h-8 px-2.5 text-xs font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
                readingMode
                  ? "bg-m3-primary text-white"
                  : "text-m3-secondary hover:text-m3-text"
              }`}
              aria-pressed={readingMode}
              title={t("serviceDetailPage.readingModeHint")}
            >
              {t("serviceDetailPage.readingMode")}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (service) {
                printService(service, songsQuery.data?.songs || []);
              }
            }}
            icon={<Printer className="w-3.5 h-3.5 text-m3-primary" />}
            title={t("print.buttons.printService")}
          >
            <span className="hidden sm:inline">{t("common.print")}</span>
          </Button>

          {!orgSettings.services.autoSave && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEntireService}
              disabled={isSavingService}
              icon={
                isSavingService ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )
              }
            >
              {isSavingService
                ? t("serviceDetailPage.savingService")
                : t("common.save")}
            </Button>
          )}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-m3-card border border-m3-border/60 shadow-[var(--shadow-sm)]"
            title={syncMeta.label}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${syncMeta.dot}`}
              aria-hidden="true"
            />
            <span className="text-[11px] font-semibold text-m3-secondary hidden sm:inline">
              {syncMeta.label}
            </span>
            <span className="w-px h-3.5 bg-m3-border/70 hidden sm:inline-block" />
            <span className="text-[11px] font-semibold text-m3-secondary">
              {elements.length}{" "}
              {elements.length === 1
                ? t("serviceDetailPage.elementSingular")
                : t("serviceDetailPage.elementPlural")}
            </span>
          </div>
        </div>
      </div>

      {!readingMode && (
        <div
          className="md:hidden flex border-b border-m3-border bg-m3-card shrink-0"
          role="tablist"
          aria-label={t("serviceDetailPage.serviceOrder")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "order"}
            onClick={() => setMobilePane("order")}
            className={`flex-1 min-h-11 text-sm font-semibold cursor-pointer ${
              mobilePane === "order"
                ? "text-m3-primary border-b-2 border-m3-primary"
                : "text-m3-secondary"
            }`}
          >
            {t("serviceDetailPage.mobileOrder")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "library"}
            onClick={() => {
              setShowLibrary(true);
              setMobilePane("library");
            }}
            className={`flex-1 min-h-11 text-sm font-semibold cursor-pointer ${
              mobilePane === "library"
                ? "text-m3-primary border-b-2 border-m3-primary"
                : "text-m3-secondary"
            }`}
          >
            {t("serviceDetailPage.mobileLibrary")}
          </button>
        </div>
      )}

      {/* ── Split Layout — panes stay mounted so width/opacity can animate ── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`absolute inset-0 flex min-h-0 min-w-0 transition-all duration-300 ease-in-out ${
            readingMode
              ? "opacity-100 translate-y-0"
              : "opacity-0 pointer-events-none translate-y-1"
          }`}
          aria-hidden={!readingMode}
        >
          <ReadingStage
            elements={elements}
            activeId={previewElement?.id ?? elements[0]?.id ?? null}
            onSelect={setPreviewElement}
          />
        </div>
        <div
          className={`flex-1 flex min-w-0 min-h-0 transition-opacity duration-300 ease-in-out ${
            readingMode ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          aria-hidden={readingMode}
        >
          {!showLibrary && (
            <button
              type="button"
              onClick={handleOpenLibrary}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-16 flex items-center justify-center bg-m3-card border border-l-0 border-m3-border rounded-r-[var(--radius-xl)] shadow-[var(--shadow-md)] text-m3-primary hover:bg-m3-primary/10 hover:border-m3-primary/40 transition-colors group cursor-pointer"
              title={t("serviceDetailPage.viewLibrary")}
              aria-label={t("serviceDetailPage.viewLibrary")}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          {/* Library Sidebar — width animates; never display:none */}
          <div
            className={`flex flex-col overflow-hidden shrink-0 min-w-0 bg-m3-sidebar/30 transition-[width,opacity] duration-300 ease-in-out ${
              showLibrary && mobilePane === "library"
                ? "max-md:w-full max-md:opacity-100"
                : "max-md:w-0 max-md:opacity-0 max-md:pointer-events-none"
            } ${
              showLibrary
                ? "md:w-80 lg:w-96 md:opacity-100 md:border-r md:border-m3-border"
                : "md:w-0 md:opacity-0 md:pointer-events-none"
            }`}
            aria-hidden={!showLibrary}
          >
            <div className="flex flex-col h-full min-h-0 w-full md:w-80 lg:w-96">
              <div className="p-4 border-b border-m3-border bg-m3-card shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-m3-text flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-m3-primary" />
                    {t("serviceDetailPage.songsLibrary")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLibrary(false);
                      setMobilePane("order");
                    }}
                    className="p-1.5 rounded-lg text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 transition-colors cursor-pointer"
                    title={t("serviceDetailPage.hideLibrary")}
                    aria-label={t("serviceDetailPage.hideLibrary")}
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    placeholder={t("serviceDetailPage.searchSongsPlaceholder")}
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    icon={<Search className="w-4 h-4 text-m3-secondary" />}
                    className="pr-9"
                  />
                  {librarySearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setLibrarySearch("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-m3-secondary hover:text-m3-text hover:bg-m3-hover transition-colors cursor-pointer"
                      title={t("serviceDetailPage.clearSearch")}
                      aria-label={t("serviceDetailPage.clearSearch")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-label">
                    {filteredLibrarySongs.length}{" "}
                    {filteredLibrarySongs.length === 1
                      ? t("serviceDetailPage.songSingular")
                      : t("serviceDetailPage.songPlural")}
                  </span>
                  <span className="text-[10px] text-m3-secondary/70 hidden md:inline">
                    {t("serviceDetailPage.dragToList")}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar divide-y divide-m3-border/60">
                {filteredLibrarySongs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-m3-secondary">
                    {t("serviceDetailPage.noSongsFound")}
                  </div>
                ) : (
                  filteredLibrarySongs.map((s) => (
                    <LibrarySongItem
                      key={s.id}
                      song={s}
                      countInService={songCountById[s.id] || 0}
                      isPending={Boolean(pendingSongIds[s.id])}
                      onAdd={handleAddSongToService}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            className={`flex flex-col min-w-0 min-h-0 overflow-hidden bg-m3-background relative flex-1 transition-[width,opacity,padding,flex-grow] duration-300 ease-in-out ${
              mobilePane === "library" && showLibrary
                ? "max-md:grow-0 max-md:w-0 max-md:opacity-0 max-md:pointer-events-none max-md:p-0"
                : ""
            } ${!showLibrary && !previewElement ? "p-4 lg:p-6" : ""}`}
          >
            <div className="max-w-5xl w-full mx-auto flex flex-col h-full min-h-0">
              <div
                className={`flex-1 flex flex-col bg-m3-card overflow-hidden min-h-0
        transition-all duration-300 ease-out
        ${
          !showLibrary && !previewElement
            ? "rounded-[var(--radius-xl)] border border-m3-border shadow-[var(--shadow-sm)]"
            : ""
        }`}
              >
                <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-m3-border shrink-0 bg-m3-sidebar/30 gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-m3-text">
                      {t("serviceDetailPage.serviceOrder")}
                    </h2>
                    {orgSettings.services.showServiceDuration && (
                      <span className="text-xs font-semibold text-m3-secondary bg-m3-background px-2.5 py-1 rounded-full border border-m3-border/50 shadow-[var(--shadow-sm)]">
                        {t("serviceDetailPage.totalDuration")}:{" "}
                        {formatDuration(totalDurationSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openAddModal("welcome")}
                      className="px-2.5 py-1 text-caption font-semibold rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border hover:bg-m3-hover hover:text-m3-text transition-colors cursor-pointer"
                    >
                      + {t("serviceDetailPage.addWelcome")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddModal("scripture")}
                      className="px-2.5 py-1 text-caption font-semibold rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border hover:bg-m3-hover hover:text-m3-text transition-colors cursor-pointer"
                    >
                      + {t("serviceDetailPage.addScripture")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddModal("message")}
                      className="px-2.5 py-1 text-caption font-semibold rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border hover:bg-m3-hover hover:text-m3-text transition-colors cursor-pointer"
                    >
                      + {t("serviceDetailPage.addMessage")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddModal("announcement")}
                      className="px-2.5 py-1 text-caption font-semibold rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border hover:bg-m3-hover hover:text-m3-text transition-colors cursor-pointer"
                    >
                      + {t("serviceDetailPage.addAnnouncement")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddModal("custom")}
                      className="px-2.5 py-1 text-caption font-semibold rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border hover:bg-m3-hover hover:text-m3-text transition-colors cursor-pointer"
                    >
                      + {t("serviceDetailPage.addCustom")}
                    </button>
                  </div>
                </div>

                {orgSettings.services.showNotes && (
                  <div className="px-5 py-2.5 border-b border-m3-border/40 shrink-0 bg-m3-background/30 flex flex-col justify-center min-h-11">
                    {isEditingGeneralNotes ? (
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={1}
                          value={generalNotes}
                          onChange={(e) => setGeneralNotes(e.target.value)}
                          placeholder={t(
                            "serviceDetailPage.generalNotesPlaceholder",
                          )}
                          className="flex-1 text-xs rounded-lg border border-m3-border p-2 bg-m3-card focus:outline-none focus:ring-1 focus:ring-m3-primary text-m3-text resize-y min-h-9"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setGeneralNotes(service?.notes || "");
                            setIsEditingGeneralNotes(false);
                          }}
                          className="h-9 text-xs shrink-0"
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            await handleSaveGeneralNotes();
                            setIsEditingGeneralNotes(false);
                          }}
                          className="h-9 text-xs shrink-0"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />{" "}
                          {t("common.save")}
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between gap-4 group cursor-pointer"
                        onClick={() => setIsEditingGeneralNotes(true)}
                      >
                        <div className="text-xs flex items-center gap-2 flex-1">
                          <FileText className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
                          {generalNotes ? (
                            <span className="text-m3-text line-clamp-1 group-hover:line-clamp-none">
                              {generalNotes}
                            </span>
                          ) : (
                            <span className="italic text-m3-secondary/70">
                              {t("serviceDetailPage.noGeneralNotes")}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-m3-secondary hover:text-m3-primary opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-m3-primary/10 shrink-0 cursor-pointer"
                          title={t("serviceDetailPage.editGeneralNotes")}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div
                  ref={dropContainerRef}
                  className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 relative custom-scrollbar transition-colors ${isDropTargetActive ? "bg-m3-primary/5 ring-2 ring-m3-primary/20 rounded-[var(--radius-xl)]" : ""}`}
                >
                  {elements.length === 0 ? (
                    <div className="m-auto text-center rounded-[var(--radius-xl)] border border-dashed border-m3-border flex flex-col items-center justify-center p-12 shrink-0">
                      <div className="w-12 h-12 rounded-[var(--radius-xl)] flex items-center justify-center bg-m3-primary/10 text-m3-primary mb-3">
                        <Music className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-m3-text">
                        {t("serviceDetailPage.emptyOutlineTitle")}
                      </h4>
                      <p className="text-xs text-m3-secondary mt-1 max-w-50">
                        {t("serviceDetailPage.emptyOutlineDesc")}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenLibrary}
                        className="mt-4 px-3 py-2 text-xs font-semibold rounded-[var(--radius-md)] border border-m3-primary/30 text-m3-primary hover:bg-m3-primary/5 transition-colors cursor-pointer"
                      >
                        {t("serviceDetailPage.viewLibrary")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col rounded-[var(--radius-lg)] border border-m3-border divide-y divide-m3-border/70 overflow-visible">
                      {elements.map((el, i) => (
                        <ServiceRow
                          key={el.id}
                          element={el}
                          index={i}
                          isPreviewed={previewElement?.id === el.id}
                          canMoveUp={i > 0}
                          canMoveDown={i < elements.length - 1}
                          onMoveUp={() => handleMoveElement(el.id, -1)}
                          onMoveDown={() => handleMoveElement(el.id, 1)}
                          onTogglePreview={handleTogglePreview}
                          onRemove={handleRemoveElement}
                          onEdit={openEditModal}
                          onNoteChange={handleNoteChange}
                          onRestoreSong={restoreSong}
                          showNotes={orgSettings.services.showNotes}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`flex flex-col overflow-hidden shrink-0 min-w-0 bg-m3-card transition-[width,opacity,transform] duration-300 ease-in-out max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 ${
              previewElement
                ? "max-md:w-full max-md:translate-x-0 max-md:opacity-100 md:w-96 lg:w-md md:opacity-100 md:border-l md:border-m3-border"
                : "max-md:w-full max-md:translate-x-full max-md:opacity-0 max-md:pointer-events-none md:w-0 md:opacity-0 md:pointer-events-none"
            }`}
            aria-hidden={!previewElement}
          >
            <div className="flex flex-col h-full min-h-0 w-full md:w-96 lg:w-md">
              {previewContent &&
                (() => {
                  const badge = getElementBadge(previewContent.type, t);
                  const Icon = badge.icon;
                  return (
                    <>
                      <div className="p-4 border-b border-m3-border bg-m3-card shrink-0">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-sm font-bold text-m3-text flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 text-m3-primary shrink-0" />
                            <span className="truncate">
                              {previewContent.title}
                            </span>
                          </h2>
                          <button
                            type="button"
                            onClick={() => setPreviewElement(null)}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 transition-colors shrink-0 cursor-pointer"
                            title={t("serviceDetailPage.closePreview")}
                            aria-label={t("serviceDetailPage.closePreview")}
                          >
                            <PanelRightClose className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                          {previewContent.type === "song" &&
                            previewContent.content && (
                              <p className="text-xs text-m3-secondary truncate">
                                {previewContent.content}
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden min-h-0">
                        {previewContent.type === "song" ? (
                          <SongPreview element={previewContent} />
                        ) : (
                          <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 py-6 custom-scrollbar">
                            {previewContent.passage && (
                              <p className="text-sm font-semibold text-m3-primary mb-4">
                                {previewContent.passage}
                              </p>
                            )}
                            {previewContent.notes && (
                              <div className="flex items-start gap-2 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
                                <StickyNote className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" />
                                <p className="text-xs text-amber-700 dark:text-amber-300 italic">
                                  {previewContent.notes}
                                </p>
                              </div>
                            )}
                            <div className="font-lyric text-[1.25rem] sm:text-[1.5rem] leading-snug text-m3-text whitespace-pre-wrap max-w-2xl">
                              {previewContent.content ||
                                t("serviceDetailPage.noContent")}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>

      <WelcomeModal
        isOpen={activeModal === "welcome"}
        onClose={() => {
          setActiveModal(null);
          setEditingElement(null);
        }}
        onSave={(data) => handleModalSave("welcome", data)}
        initial={newGenericInitial}
      />
      <ScriptureModal
        isOpen={activeModal === "scripture"}
        onClose={() => {
          setActiveModal(null);
          setEditingElement(null);
        }}
        onSave={(data) => handleModalSave("scripture", data)}
        initial={newGenericInitial}
      />
      <MessageModal
        isOpen={activeModal === "message"}
        onClose={() => {
          setActiveModal(null);
          setEditingElement(null);
        }}
        onSave={(data) => handleModalSave("message", data)}
        initial={newMessageInitial}
      />
      <AnnouncementModal
        isOpen={activeModal === "announcement"}
        onClose={() => {
          setActiveModal(null);
          setEditingElement(null);
        }}
        onSave={(data) => handleModalSave("announcement", data)}
        initial={newGenericInitial}
      />
      <CustomModal
        isOpen={activeModal === "custom"}
        onClose={() => {
          setActiveModal(null);
          setEditingElement(null);
        }}
        onSave={(data) => handleModalSave("custom", data)}
        initial={newGenericInitial}
      />
    </div>
  );
};
