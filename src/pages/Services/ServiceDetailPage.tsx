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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Clock3,
  Edit3,
  FileText,
  GripVertical,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Megaphone,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  Plus,
  Printer,
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
import { usePrint } from "../../contexts/PrintContext";
import { useSync } from "../../contexts/SyncContext";
import { useOrgSettings } from "../../hooks/useOrgSettings";
import { useService, useServices } from "../../hooks/useServices";
import { useSearchableSongs, useSong, useSongs } from "../../hooks/useSongs";
import { AnnouncementModal } from "./modals/Anouncement";
import { ScriptureModal } from "./modals/Bible";
import { CustomModal } from "./modals/Custom";
import { MessageModal } from "./modals/Message";
import { WelcomeModal } from "./modals/Welcome";

function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(fromIndex, 1);
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
        color: "#0284c7",
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

const SongPreview: React.FC<{ element: ServiceElement }> = ({ element }) => {
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
      <div className="flex items-center justify-center h-full text-sm text-rose-500 font-medium">
        {t("serviceDetailPage.songNotFound")}
      </div>
    );

  return (
    <div className="flex flex-col h-full relative">
      <div className="h-10 bg-m3-sidebar/50 border-b border-m3-border dark:border-m3-dark-border flex items-center justify-between px-3 shrink-0">
        <span className="text-[10px] font-semibold text-m3-secondary uppercase tracking-wider flex items-center gap-1.5">
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

      <div
        className="flex-1 overflow-auto bg-m3-card relative custom-scrollbar p-2"
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
      className={`flex items-center justify-between gap-3 px-3 py-2 bg-m3-card hover:bg-m3-hover rounded-xl border border-m3-border/50 cursor-grab active:cursor-grabbing transition-all shadow-sm ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
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
          className="p-1.5 rounded-lg bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 disabled:opacity-50 transition-colors cursor-pointer"
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
  showNotes?: boolean;
}

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
  showNotes = true,
}) => {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

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
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(element.notes || "");
  useEffect(() => setLocalNote(element.notes || ""), [element.notes]);

  const isSong = element.type === "song";
  const badge = getElementBadge(element.type, t);
  const Icon = badge.icon;

  const handleExpandToggle = () => {
    if (isSong) onTogglePreview(element);
    else setIsExpanded(!isExpanded);
  };

  return (
    <div
      ref={rowRef}
      className={`bg-white dark:bg-m3-card rounded-2xl border transition-all duration-150 relative ${
        isDragging ? "opacity-40 scale-[0.98]" : "opacity-100"
      } ${isPreviewed ? "ring-2 ring-m3-primary/30 shadow-md" : ""} ${
        closestEdge === "top"
          ? "border-t-m3-primary border-t-2 shadow-sm"
          : closestEdge === "bottom"
            ? "border-b-m3-primary border-b-2 shadow-sm"
            : "border-m3-border dark:border-m3-border/30 hover:border-m3-primary/30"
      } flex flex-col`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          ref={dragHandleRef}
          type="button"
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-m3-hover touch-none"
          title={t("serviceDetailPage.dragToReorder")}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="text-xs font-semibold text-slate-400 w-4 shrink-0 text-center">
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate text-m3-text">
              {element.title || t("serviceDetailPage.untitledElement")}
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
            {Number(element.duration || 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                <Clock3 className="w-3 h-3 inline mr-1" />{" "}
                {formatDuration(Number(element.duration || 0))}
              </span>
            )}
          </div>
          {element.passage && (
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {element.passage}
            </p>
          )}
          {element.content && !isSong && !isExpanded && (
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              {element.content}
            </p>
          )}
          {showNotes && (isEditingNote || element.notes) && !isExpanded && (
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <StickyNote className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
              <span className="text-xs italic text-amber-700 dark:text-amber-300/90 truncate">
                {element.notes}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
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
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isSong && isPreviewed ? "bg-m3-primary/10 text-m3-primary" : "text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10"}`}
            title={
              isSong
                ? isPreviewed
                  ? t("serviceDetailPage.closePreview")
                  : t("serviceDetailPage.openPreview")
                : isExpanded
                  ? t("serviceDetailPage.collapse")
                  : t("serviceDetailPage.expand")
            }
          >
            {isSong ? (
              isPreviewed ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRight className="w-4 h-4" />
              )
            ) : isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 rounded-lg transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-40 bg-white dark:bg-m3-card rounded-xl shadow-lg border border-m3-border dark:border-m3-border/40 py-1">
                  {!isSong && (
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(element);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-m3-text hover:bg-m3-hover cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />{" "}
                      {t("serviceDetailPage.editElement")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNote(true);
                      setIsExpanded(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-m3-text hover:bg-m3-hover cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />{" "}
                    {element.notes
                      ? t("serviceDetailPage.editNotes")
                      : t("serviceDetailPage.addNotes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(element.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />{" "}
                    {t("serviceDetailPage.removeElement")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (isEditingNote || element.notes) && (
        <div className="border-t border-m3-border dark:border-m3-border/30 bg-m3-sidebar/10 dark:bg-black/10 rounded-b-2xl p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-m3-secondary uppercase tracking-wider flex items-center gap-1">
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
                  className="flex-1 text-xs rounded-lg border border-m3-border px-3 py-2 bg-white dark:bg-m3-card focus:outline-none focus:border-m3-primary text-m3-text"
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
              <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                {element.notes}
              </div>
            )}
          </div>
        </div>
      )}
      {isExpanded && !isSong && (
        <div className="pt-0 p-4 flex flex-col gap-4">
          <div className="mt-2 text-sm text-m3-text whitespace-pre-wrap bg-white dark:bg-m3-card p-4 rounded-xl border border-m3-border dark:border-m3-border/50">
            {element.content || t("serviceDetailPage.noContent")}
          </div>
        </div>
      )}
    </div>
  );
};

type ModalType =
  "welcome" | "scripture" | "message" | "announcement" | "custom" | null;

export const ServiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useAppNavigate();
  const { t } = useI18n();

  const { data: service, isLoading, isError } = useService(id || null);
  const { updateElements, updateService } = useServices();
  const { songsQuery } = useSongs();
  const { foldersQuery } = useFolders();
  const { showToast, syncStatus } = useSync();
  const { settings: orgSettings } = useOrgSettings();
  const { printService } = usePrint();

  const [elements, setElements] = useState<ServiceElement[]>([]);
  const elementsRef = useRef<ServiceElement[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [pendingSongIds, setPendingSongIds] = useState<Record<string, number>>(
    {},
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showLibrary, setShowLibrary] = useState(true);
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

  useEffect(() => {
    if (service) {
      setGeneralNotes(service.notes || "");
      const sortedElements = [...(service.elements || [])].sort(
        (a, b) => (a.position || 0) - (b.position || 0),
      );
      setElements(sortedElements);
      elementsRef.current = sortedElements;
    }
  }, [service]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

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
      dot: "bg-sky-500 animate-pulse",
      label: t("misc.syncStatus.syncing"),
    },
    error: { dot: "bg-rose-500", label: t("misc.syncStatus.error") },
    offline: { dot: "bg-amber-500", label: t("misc.syncStatus.offline") },
    local_only: { dot: "bg-slate-400", label: t("misc.syncStatus.local_only") },
  } as const;
  const syncMeta = syncStatusMeta[syncStatus] ?? syncStatusMeta.local_only;

  const handleOpenLibrary = () => {
    setShowLibrary(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

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
    await syncElements(elements.filter((e) => e.id !== elementId));
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
      elements.map((e) => (e.id === elementId ? { ...e, notes: note } : e)),
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
    let nextElements = [...elements];
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
        position: elements.length,
        duration: data.duration || 0,
      });
    }
    await syncElements(nextElements);
    setActiveModal(null);
    setEditingElement(null);
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
            await syncElements(reordered);
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

          await handleAddSongToService(songId, insertBeforeId);
        }
      },
    });
  }, []);

  const editInitial = editingElement
    ? {
        title: editingElement.title,
        content: editingElement.content || "",
        passage: editingElement.passage || "",
        notes: editingElement.notes || "",
        duration: Number(editingElement.duration || 0),
      }
    : undefined;

  // When creating new elements, pre-fill duration from org defaults
  const newMessageInitial = editInitial ?? {
    title: "",
    content: "",
    passage: "",
    notes: "",
    duration: orgSettings.services.sermonDuration,
  };
  const newGenericInitial = editInitial ?? {
    title: "",
    content: "",
    passage: "",
    notes: "",
    duration: orgSettings.services.songDuration,
  };

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-m3-sidebar/10">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="h-14 bg-m3-sidebar border-b border-m3-border flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="p-1 -ml-2"
            title={t("common.back")}
          >
            <ArrowLeft className="w-4 h-4 text-m3-secondary" />
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (service) {
                printService(service, songsQuery.data?.songs || []);
              }
            }}
            icon={<Printer className="w-3.5 h-3.5 text-sky-500" />}
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-m3-card border border-m3-border/60 shadow-sm"
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

      {/* ── Split Layout ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {!showLibrary && (
          <button
            type="button"
            onClick={handleOpenLibrary}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-16 flex items-center justify-center bg-m3-card border border-l-0 border-m3-border rounded-r-2xl shadow-md text-m3-primary hover:bg-m3-primary/10 hover:border-m3-primary/40 transition-colors group cursor-pointer"
            title={t("serviceDetailPage.viewLibrary")}
            aria-label={t("serviceDetailPage.viewLibrary")}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        {/* Library Sidebar */}
        <div
          className={`transition-all duration-300 flex flex-col border-r border-m3-border bg-m3-sidebar/30 ${showLibrary ? "w-full md:w-80 lg:w-96 translate-x-0" : "w-0 -translate-x-full border-none opacity-0 overflow-hidden"}`}
        >
          <div className="p-4 border-b border-m3-border bg-m3-card shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-m3-text flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-m3-primary" />
                {t("serviceDetailPage.songsLibrary")}
              </h2>
              <button
                type="button"
                onClick={() => setShowLibrary(false)}
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
              <span className="text-[10px] font-semibold text-m3-secondary uppercase tracking-wider">
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
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-2">
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

        <div
          className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-m3-background relative
    transition-all duration-250 ease-out
    ${!showLibrary && !previewElement ? "p-4 lg:p-6" : ""}`}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col h-full">
            <div
              className={`flex-1 flex flex-col bg-m3-card overflow-hidden min-h-0
        transition-all duration-300 ease-out
        ${
          !showLibrary && !previewElement
            ? "rounded-3xl border border-m3-border shadow-sm"
            : ""
        }`}
            >
              <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-m3-border shrink-0 bg-m3-sidebar/30 gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-m3-text">
                    {t("serviceDetailPage.serviceOrder")}
                  </h2>
                  {orgSettings.services.showServiceDuration && (
                    <span className="text-xs font-semibold text-m3-secondary bg-m3-background px-2.5 py-1 rounded-full border border-m3-border/50 shadow-sm">
                      {t("serviceDetailPage.totalDuration")}:{" "}
                      {formatDuration(totalDurationSeconds)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openAddModal("welcome")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                  >
                    + {t("serviceDetailPage.addWelcome")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal("scripture")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 transition-colors cursor-pointer"
                  >
                    + {t("serviceDetailPage.addScripture")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal("message")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                  >
                    + {t("serviceDetailPage.addMessage")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal("announcement")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                  >
                    + {t("serviceDetailPage.addAnnouncement")}
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
                        className="flex-1 text-xs rounded-lg border border-m3-border p-2 bg-white dark:bg-m3-card focus:outline-none focus:ring-1 focus:ring-m3-primary text-m3-text resize-y min-h-9"
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
                        <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
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
                          <span className="text-m3-text line-clamp-1 group-hover:line-clamp-none transition-all">
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
                className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative custom-scrollbar transition-colors ${isDropTargetActive ? "bg-m3-primary/5 ring-2 ring-m3-primary/20 rounded-2xl" : ""}`}
              >
                {elements.length === 0 ? (
                  <div className="m-auto text-center rounded-2xl border border-dashed border-m3-border flex flex-col items-center justify-center p-12 shrink-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-m3-primary/10 text-m3-primary mb-3">
                      <Music className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-m3-text">
                      {t("serviceDetailPage.emptyOutlineTitle")}
                    </h4>
                    <p className="text-xs text-m3-secondary mt-1 max-w-50">
                      {t("serviceDetailPage.emptyOutlineDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
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
                        showNotes={orgSettings.services.showNotes}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-3 mt-auto pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenLibrary}
                    className="flex-1 py-3 rounded-2xl border border-dashed border-m3-primary/30 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-m3-primary/5 text-m3-primary bg-m3-card shadow-sm"
                    title={t("serviceDetailPage.openLibraryToSearch")}
                  >
                    <Plus className="w-4 h-4" />{" "}
                    {t("serviceDetailPage.addSong")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal("custom")}
                    className="flex-1 py-3 rounded-2xl border border-dashed border-m3-border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-m3-sidebar text-m3-secondary bg-m3-card shadow-sm"
                  >
                    <Plus className="w-4 h-4" />{" "}
                    {t("serviceDetailPage.addCustom")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`transition-all duration-300 flex flex-col border-l border-m3-border bg-m3-sidebar/30 ${previewElement ? "w-full md:w-96 lg:w-md translate-x-0" : "w-0 translate-x-full border-none opacity-0 overflow-hidden"}`}
        >
          {previewContent && (
            <>
              <div className="p-4 border-b border-m3-border bg-m3-card shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-m3-text flex items-center gap-2 min-w-0">
                    <Music className="w-4 h-4 text-m3-primary shrink-0" />
                    <span className="truncate">{previewContent.title}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPreviewElement(null)}
                    className="p-1.5 rounded-lg text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 transition-colors shrink-0 cursor-pointer"
                    title={t("serviceDetailPage.closePreview")}
                    aria-label={t("serviceDetailPage.closePreview")}
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-m3-secondary truncate mt-0.5">
                  {previewContent.content || "—"}
                </p>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <SongPreview element={previewContent} />
              </div>
            </>
          )}
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
