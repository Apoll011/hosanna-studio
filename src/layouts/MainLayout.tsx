/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Folder, Service, Song } from "@/src/types";
import { ConversionResult } from "@hosanna/chordpro";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  BatchActionFloatingBar,
  buildFolderTree,
  getFolderAncestors,
  getFolderDescendantIds,
} from "../components/explorer";
import { HosannaCommandPalette } from "../components/HosannaCommandPalette";
import {
  AppSidebar,
  ContextMenuState,
  ExplorerAddressBar,
  ExplorerContextMenu,
  ExplorerModals,
  ExplorerToolbar,
} from "../components/layout";
import { ToastContainer } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import { usePrint } from "../contexts/PrintContext";
import { useSync } from "../contexts/SyncContext";
import { getDatabase, purgeExpiredTrash } from "../db";
import { useAgenda } from "../hooks/useAgenda";
import { useAppNavigate } from "../hooks/useAppNavigate";
import { useCollections } from "../hooks/useCollections";
import { useFolders } from "../hooks/useFolders";
import { usePersonalSettings } from "../hooks/usePersonalSettings";
import { useServices } from "../hooks/useServices";
import { useSearchableSongs, useSongs } from "../hooks/useSongs";
import { useTrash } from "../hooks/useTrash";
import { songImportRegistry } from "../lib/import";
import { filterSearchableSongsWithLiqe } from "../utils";
import { ProviderImportResult } from "../utils/import";
import { deriveView } from "./view";

export const MainLayout: React.FC = () => {
  const { navigate } = useAppNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, logout, organization, organizations, switchOrganization } =
    useAuth();

  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";
  const view = useMemo(
    () => deriveView(location.pathname, slugPrefix),
    [location.pathname, slugPrefix],
  );

  const { settings, updateSetting } = usePersonalSettings();

  // Sidebar & Responsive State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isSidebarCollapsed = settings.sidebarCollapsed;
  const setIsSidebarCollapsed = useCallback(
    (v: boolean) => updateSetting("sidebarCollapsed", v),
    [updateSetting],
  );

  const { upcomingEventCount } = useAgenda();
  const { printSong, printSongs, printFolder, printFolders, printBatch } =
    usePrint();

  // Service Worker & Sync
  const { showToast, triggerSyncCheck } = useSync();

  const handleSwitchOrganization = useCallback(
    async (org: Parameters<typeof switchOrganization>[0]) => {
      try {
        await switchOrganization(org);
      } catch (err) {
        showToast({
          type: "error",
          title: t("settings.workspace.switchOrgError", {
            error: (err as { message?: string })?.message || "",
          }),
        });
      }
    },
    [switchOrganization, showToast, t],
  );
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {},
  });

  useEffect(() => {
    if (needRefresh) {
      showToast({
        type: "info",
        title: t("layout.newVersionTitle"),
        description: t("layout.newVersionDesc"),
        duration: 0,
        action: {
          label: t("layout.reload"),
          onClick: () => {
            void updateServiceWorker(true);
          },
        },
      });
    }
  }, [needRefresh, showToast, updateServiceWorker, t]);

  useEffect(() => {
    const runTrashVerifier = () => {
      void getDatabase().then(purgeExpiredTrash);
    };
    runTrashVerifier();
    const interval = setInterval(() => {
      void triggerSyncCheck();
      runTrashVerifier();
    }, 60000);
    return () => clearInterval(interval);
  }, [triggerSyncCheck]);

  // Queries & Mutations
  //TODO: Maybe find a better way to handle the archived services
  const { servicesQuery, createService, deleteService } = useServices(true);
  const allServices = useMemo(
    () => servicesQuery.data || [],
    [servicesQuery.data],
  );

  const [showArchived, setShowArchived] = useState(false);
  const { servicesQuery: archivedServicesQuery } = useServices(true);
  const archivedServices = useMemo(
    () =>
      showArchived
        ? (archivedServicesQuery.data ?? []).filter((s) => s.archived)
        : [],
    [showArchived, archivedServicesQuery.data],
  );

  const {
    foldersQuery,
    createFolder,
    renameFolder,
    customizeFolder,
    moveFolder,
    deleteFolder,
  } = useFolders();

  const { songsQuery, moveSong, deleteSong, updateBatchTags, createSong } =
    useSongs();

  const { items: trashItems } = useTrash();

  // Folder & Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const navigateBackToDrive = useCallback(() => {
    if (view !== "explorer") {
      navigate(`${slugPrefix}/folders`);
    }
  }, [view, navigate, slugPrefix]);

  const handleSelectFolder = useCallback(
    (folderId: string | null) => {
      setCurrentFolderId(folderId);
      if (view !== "explorer") {
        navigate(`${slugPrefix}/folders`);
      }
    },
    [view, navigate, slugPrefix],
  );

  // View Mode & Density
  const viewMode = settings.viewMode;
  const handleViewModeChange = useCallback(
    (mode: "grid" | "list") => {
      updateSetting("viewMode", mode);
      if (view === "settings") {
        navigate(`${slugPrefix}/folders`);
      }
    },
    [view, navigate, slugPrefix, updateSetting],
  );

  const density = settings.explorerDensity;
  const handleDensityChange = useCallback(
    (d: "comfortable" | "compact") => {
      updateSetting("explorerDensity", d);
    },
    [updateSetting],
  );

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  const [sortBy, setSortBy] = useState<
    "title" | "artist" | "updatedAt" | "number"
  >("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const handleSearchChange = useCallback(
    (val: string) => {
      setSearchQuery(val);
      if (view === "settings") {
        navigate(`${slugPrefix}/folders`);
      }
    },
    [view, navigate, slugPrefix],
  );

  const handleSortChange = useCallback(
    (sb: "title" | "artist" | "updatedAt" | "number", so: "asc" | "desc") => {
      setSortBy(sb);
      setSortOrder(so);
      if (view === "settings") {
        navigate(`${slugPrefix}/folders`);
      }
    },
    [view, navigate, slugPrefix],
  );

  // Search Context Persistence
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prevPath = prevPathnameRef.current;
    const currPath = location.pathname;

    if (prevPath !== currPath) {
      const getDomain = (path: string) => {
        if (path === "/songs" || path.startsWith("/songs/")) return "songs";
        if (path === "/services" || path.startsWith("/services/"))
          return "services";
        if (path === "/folders" || path.startsWith("/folders/"))
          return "explorer";
        if (path.startsWith("/settings")) return "settings";
        return "other";
      };

      const prevDomain = getDomain(prevPath);
      const currDomain = getDomain(currPath);

      const isSongDomain =
        (prevDomain === "songs" || prevDomain === "explorer") &&
        (currDomain === "songs" || currDomain === "explorer");

      const isServiceDomain =
        prevDomain === "services" && currDomain === "services";

      const keepSearch = isSongDomain || isServiceDomain;

      if (!keepSearch) {
        setSearchQuery("");
        setSelectedKey("");
        setSelectedTag("");
        setIsFilterPanelOpen(false);
      }
    }

    prevPathnameRef.current = currPath;
  }, [location.pathname]);

  // Data Memos
  const allFolders = useMemo(
    () => foldersQuery.data?.folders || [],
    [foldersQuery.data?.folders],
  );
  const allSongs = useMemo(
    () => songsQuery.data?.songs || [],
    [songsQuery.data?.songs],
  );
  const { searchableSongs } = useSearchableSongs(allFolders);

  const totalSongs = songsQuery.data?.total || 0;
  const totalServices =
    servicesQuery.data?.filter((s) => !s.archived).length || 0;
  const rootSongsCount = foldersQuery.data?.rootSongsCount || 0;
  const rootFoldersCount = foldersQuery.data?.folders.length || 0;

  const folderTree = useMemo(() => buildFolderTree(allFolders), [allFolders]);
  const currentFolder = useMemo(
    () => allFolders.find((f) => f.id === currentFolderId),
    [allFolders, currentFolderId],
  );

  const descendantFolderIds = useMemo(() => {
    if (currentFolderId === null) {
      return new Set(allFolders.map((f) => f.id));
    }
    return getFolderDescendantIds(currentFolderId, allFolders);
  }, [currentFolderId, allFolders]);

  const getFolderPathString = useCallback(
    (folderId: string | null | undefined): string => {
      const trail = getFolderAncestors(folderId, allFolders);
      return trail.length > 0
        ? trail.map((f) => f.name).join(" / ")
        : t("common.root");
    },
    [allFolders, t],
  );

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    allSongs.forEach((s) => {
      if (s.tags) s.tags.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet).sort();
  }, [allSongs]);

  const folderBreadcrumbs = useMemo(
    () => getFolderAncestors(currentFolderId, allFolders),
    [currentFolderId, allFolders],
  );

  const currentSongId =
    view === "song-editor" ? location.pathname.split("/").pop() : null;
  const currentSong = useMemo(
    () => allSongs.find((s) => s.id === currentSongId),
    [allSongs, currentSongId],
  );

  const songBreadcrumbs = useMemo(
    () => getFolderAncestors(currentSong?.folderId, allFolders),
    [currentSong, allFolders],
  );

  const currentSongFileName = useMemo(() => {
    if (!currentSong) return "";
    const title = currentSong.title || "";
    if (
      title.endsWith(".chordpro") ||
      title.endsWith(".pro") ||
      title.endsWith(".txt") ||
      title.endsWith(".chopro")
    ) {
      return title;
    }
    let ext = ".chordpro";
    if (currentSong.path) {
      const match = currentSong.path.match(/\.[a-z0-9]+$/i);
      if (match) ext = match[0];
    }
    return `${title}${ext}`;
  }, [currentSong]);

  const currentServiceId =
    view === "service-editor" ? location.pathname.split("/").pop() : null;
  const currentService = useMemo(
    () => allServices.find((s) => s.id === currentServiceId),
    [allServices, currentServiceId],
  );

  const isSearchingOrFiltering = Boolean(searchQuery.trim());
  const activeFiltersCount = searchQuery.trim() ? 1 : 0;

  // Filtered Folders & Files
  const filteredSubfolders = useMemo(() => {
    let list: Folder[];

    if (!isSearchingOrFiltering) {
      list =
        currentFolderId === null
          ? allFolders.filter((f) => !f.parentId)
          : allFolders.filter((f) => f.parentId === currentFolderId);
    } else {
      const q = searchQuery.toLowerCase().trim();
      list = allFolders.filter((f) => {
        if (f.id === currentFolderId) return false;
        if (currentFolderId !== null && !descendantFolderIds.has(f.id)) {
          return false;
        }
        if (q) {
          return f.name.toLowerCase().includes(q);
        }
        return true;
      });
    }

    return [...list].sort((a, b) => {
      let valA = (a.name || "").toLowerCase();
      let valB = (b.name || "").toLowerCase();

      if (sortBy === "updatedAt") {
        valA = a.createdAt || "";
        valB = b.createdAt || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    allFolders,
    currentFolderId,
    descendantFolderIds,
    isSearchingOrFiltering,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  const filteredFiles = useMemo(() => {
    let list: Song[];

    if (!isSearchingOrFiltering) {
      list = allSongs.filter((s) => {
        if (currentFolderId === null) {
          return !s.folderId;
        }
        return s.folderId === currentFolderId;
      });
    } else {
      // 1. If searching with a query, filter with Liqe across SearchableSong dataset
      let matchedSongIds: Set<string> | null = null;
      if (searchQuery.trim()) {
        const liqeMatches = filterSearchableSongsWithLiqe(
          searchableSongs,
          searchQuery,
        );
        matchedSongIds = new Set(liqeMatches.map((s) => s.id));
      }

      list = allSongs.filter((s) => {
        if (currentFolderId !== null) {
          if (!s.folderId || !descendantFolderIds.has(s.folderId)) {
            return false;
          }
        }

        if (selectedTag && (!s.tags || !s.tags.includes(selectedTag)))
          return false;

        if (matchedSongIds !== null && !matchedSongIds.has(s.id)) {
          return false;
        }

        return true;
      });
    }

    return [...list].sort((a, b) => {
      let valA: string | number = (a.title || "").toLowerCase();
      let valB: string | number = (b.title || "").toLowerCase();

      if (sortBy === "artist") {
        valA = (a.artist || "").toLowerCase();
        valB = (b.artist || "").toLowerCase();
      } else if (sortBy === "updatedAt") {
        valA = a.updatedAt || "";
        valB = b.updatedAt || "";
      } else if (sortBy === "number") {
        valA = a.song_number || Infinity;
        valB = b.song_number || Infinity;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    allSongs,
    searchableSongs,
    currentFolderId,
    descendantFolderIds,
    isSearchingOrFiltering,
    searchQuery,
    selectedTag,
    sortBy,
    sortOrder,
  ]);

  // Selection State
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const viewItems = useMemo(() => {
    const folders = filteredSubfolders.map((f) => ({
      id: f.id,
      type: "folder" as const,
      item: f,
    }));
    const songs = filteredFiles.map((s) => ({
      id: s.id,
      type: "song" as const,
      item: s,
    }));
    return [...folders, ...songs];
  }, [filteredSubfolders, filteredFiles]);

  const toggleFolderSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSongSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFolderIds(new Set());
    setSelectedSongIds(new Set());
    setLastClickedId(null);
  }, []);

  const selectAllInCurrentView = useCallback(() => {
    setSelectedFolderIds(new Set(filteredSubfolders.map((f) => f.id)));
    setSelectedSongIds(new Set(filteredFiles.map((s) => s.id)));
  }, [filteredSubfolders, filteredFiles]);

  useEffect(() => {
    clearSelection();
  }, [currentFolderId, clearSelection]);

  const handleItemClick = useCallback(
    (e: React.MouseEvent, id: string, type: "folder" | "song") => {
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        if (type === "folder") toggleFolderSelect(id);
        else toggleSongSelect(id);
        setLastClickedId(id);
      } else if (e.shiftKey && lastClickedId) {
        const allIds = viewItems.map((v) => v.id);
        const idx1 = allIds.indexOf(lastClickedId);
        const idx2 = allIds.indexOf(id);

        if (idx1 !== -1 && idx2 !== -1) {
          const start = Math.min(idx1, idx2);
          const end = Math.max(idx1, idx2);
          const range = viewItems.slice(start, end + 1);

          const nextFolders = new Set<string>();
          const nextSongs = new Set<string>();

          range.forEach((v) => {
            if (v.type === "folder") nextFolders.add(v.id);
            else nextSongs.add(v.id);
          });

          setSelectedFolderIds(nextFolders);
          setSelectedSongIds(nextSongs);
        } else {
          if (type === "folder") {
            setSelectedFolderIds(new Set([id]));
            setSelectedSongIds(new Set());
          } else {
            setSelectedFolderIds(new Set());
            setSelectedSongIds(new Set([id]));
          }
        }
        setLastClickedId(id);
      } else {
        if (type === "folder") {
          setSelectedFolderIds(new Set([id]));
          setSelectedSongIds(new Set());
        } else {
          setSelectedFolderIds(new Set());
          setSelectedSongIds(new Set([id]));
        }
        setLastClickedId(id);
      }
    },
    [viewItems, lastClickedId, toggleFolderSelect, toggleSongSelect],
  );

  // Marquee Rubberband Selection
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const isMouseDownRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const initialSelectionRef = useRef<{
    folders: Set<string>;
    songs: Set<string>;
  }>({
    folders: new Set(),
    songs: new Set(),
  });

  const handleWorkspaceMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (target.closest('button, input, a, [role="dialog"], [data-item-id]')) {
        return;
      }

      const isAdditive = e.ctrlKey || e.metaKey;

      isMouseDownRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      if (!isAdditive) {
        clearSelection();
        initialSelectionRef.current = { folders: new Set(), songs: new Set() };
      } else {
        initialSelectionRef.current = {
          folders: new Set(selectedFolderIds),
          songs: new Set(selectedSongIds),
        };
      }
    },
    [selectedFolderIds, selectedSongIds, clearSelection],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        !isMouseDownRef.current ||
        !startPosRef.current ||
        !containerRef.current
      )
        return;

      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width > 4 || height > 4) {
        setSelectionBox({ x: left, y: top, width, height });

        const itemEls =
          containerRef.current.querySelectorAll<HTMLElement>("[data-item-id]");
        const nextFolders = new Set(initialSelectionRef.current.folders);
        const nextSongs = new Set(initialSelectionRef.current.songs);

        itemEls.forEach((el) => {
          const id = el.getAttribute("data-item-id");
          const type = el.getAttribute("data-item-type") as "folder" | "song";
          if (!id || !type) return;

          const rect = el.getBoundingClientRect();
          const intersects = !(
            rect.right < left ||
            rect.left > left + width ||
            rect.bottom < top ||
            rect.top > top + height
          );

          if (intersects) {
            if (type === "folder") nextFolders.add(id);
            else nextSongs.add(id);
          }
        });

        setSelectedFolderIds(nextFolders);
        setSelectedSongIds(nextSongs);
      }
    };

    const handleMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        startPosRef.current = null;
        setSelectionBox(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const totalSelectedCount = selectedFolderIds.size + selectedSongIds.size;
  const selectedFolderObjects = useMemo(
    () => allFolders.filter((f) => selectedFolderIds.has(f.id)),
    [allFolders, selectedFolderIds],
  );

  const disabledFolderIdsForBatchMove = useMemo(() => {
    const disabled = new Set<string>();
    const selectedList = Array.from(selectedFolderIds);
    selectedList.forEach((id) => disabled.add(id));

    function addDescendants(folderId: string) {
      const children = allFolders.filter((f) => f.parentId === folderId);
      children.forEach((child) => {
        disabled.add(child.id);
        addDescendants(child.id);
      });
    }

    selectedList.forEach((id) => addDescendants(id));
    return disabled;
  }, [selectedFolderIds, allFolders]);

  // Modals & Context Menu State
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchTagOpen, setIsBatchTagOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateSongModalOpen, setIsCreateSongModalOpen] = useState(false);
  const [isCreateServiceModalOpen, setIsCreateServiceModalOpen] =
    useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] =
    useState(false);
  const [isCifraImportOpen, setIsCifraImportOpen] = useState(false);

  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [customizeTarget, setCustomizeTarget] = useState<Folder | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<Folder | null>(null);
  const [targetParentFolderId, setTargetParentFolderId] = useState<
    string | null
  >(null);

  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [deleteAcao, setDeleteAcao] = useState<"move_to_root" | "delete_songs">(
    "move_to_root",
  );
  const [confirmFolderName, setConfirmFolderName] = useState("");

  const [moveSongTarget, setMoveSongTarget] = useState<Song | null>(null);
  const [targetSongFolderId, setTargetSongFolderId] = useState<string | null>(
    null,
  );
  const [deleteSongTarget, setDeleteSongTarget] = useState<Song | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [_isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isInternalDragActive, setIsInternalDragActive] = useState(false);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null,
  );

  const { collections } = useCollections();

  // Auto-expand folder tree
  useEffect(() => {
    if (currentFolderId && allFolders.length > 0) {
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        let curr = allFolders.find((f) => f.id === currentFolderId);
        while (curr) {
          next.add(curr.id);
          if (!curr.parentId) break;
          curr = allFolders.find((f) => f.id === curr?.parentId);
        }
        return next;
      });
    }
  }, [currentFolderId, allFolders]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Context Menu Trigger Handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, type: "folder" | "song", item: Folder | Song) => {
      e.preventDefault();
      e.stopPropagation();

      const isAlreadySelected =
        type === "folder"
          ? selectedFolderIds.has(item.id)
          : selectedSongIds.has(item.id);

      if (!isAlreadySelected) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          if (type === "folder") {
            setSelectedFolderIds(new Set([item.id]));
            setSelectedSongIds(new Set());
          } else {
            setSelectedFolderIds(new Set());
            setSelectedSongIds(new Set([item.id]));
          }
          setLastClickedId(item.id);
        } else {
          if (type === "folder") toggleFolderSelect(item.id);
          else toggleSongSelect(item.id);
          setLastClickedId(item.id);
        }
      }

      const x = Math.min(e.clientX, window.innerWidth - 240);
      const y = Math.min(e.clientY, window.innerHeight - 280);

      setContextMenu({ x, y, type, item });
    },
    [selectedFolderIds, selectedSongIds, toggleFolderSelect, toggleSongSelect],
  );

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-item-id]")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 300);

    setContextMenu({ x, y, type: "canvas", item: null });
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        clearSelection();
        return;
      }

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (view !== "explorer") return;
        e.preventDefault();
        selectAllInCurrentView();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (totalSelectedCount === 0) return;
        e.preventDefault();

        if (totalSelectedCount === 1) {
          if (selectedFolderIds.size === 1) {
            const folder = allFolders.find(
              (f) => f.id === Array.from(selectedFolderIds)[0],
            );
            if (folder) setDeleteTarget(folder);
          } else {
            const song = allSongs.find(
              (s) => s.id === Array.from(selectedSongIds)[0],
            );
            if (song) setDeleteSongTarget(song);
          }
        } else {
          setIsBatchDeleteOpen(true);
        }
        return;
      }

      if (e.key === "Enter") {
        if (totalSelectedCount !== 1) return;
        if (selectedFolderIds.size === 1) {
          handleSelectFolder(Array.from(selectedFolderIds)[0]);
        } else if (selectedSongIds.size === 1) {
          navigate(`${slugPrefix}/songs/${Array.from(selectedSongIds)[0]}`);
        }
      }
    };

    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    totalSelectedCount,
    selectedFolderIds,
    selectedSongIds,
    allFolders,
    allSongs,
    view,
    clearSelection,
    selectAllInCurrentView,
    handleSelectFolder,
    navigate,
    slugPrefix,
  ]);

  // Folder Actions
  const handleCreateFolderSubmit = async (name: string) => {
    try {
      await createFolder({ name, parentId: currentFolderId });
      setIsCreateModalOpen(false);
    } catch {
      // Toast notification is already handled by useFolders
    }
  };

  const handleRenameFolderSubmit = async (name: string) => {
    if (!renameTarget) return;
    try {
      await renameFolder({
        id: renameTarget.id,
        name,
        updatedAt: renameTarget.updatedAt!,
      });
      setRenameTarget(null);
    } catch {
      // Toast notification is already handled by useFolders
    }
  };

  const handleCustomizeFolderSubmit = async (color: string, icon: string) => {
    if (!customizeTarget) return;
    try {
      await customizeFolder({
        id: customizeTarget.id,
        color,
        icon,
        updatedAt: customizeTarget.updatedAt!,
      });
      setCustomizeTarget(null);
    } catch {
      // Toast notification is already handled by useFolders
    }
  };

  const handleMoveFolderSubmit = async () => {
    if (!moveFolderTarget) return;
    try {
      await moveFolder({
        id: moveFolderTarget.id,
        parentId: targetParentFolderId,
        updatedAt: moveFolderTarget.updatedAt!,
      });
      setMoveFolderTarget(null);
    } catch {
      // Toast notification is already handled by useFolders
    }
  };

  const handleDeleteFolderSubmit = async () => {
    if (!deleteTarget) return;
    if (
      deleteAcao === "delete_songs" &&
      confirmFolderName.trim() !== deleteTarget.name.trim()
    ) {
      showToast(t("layout.folderNameMismatch"), "error");
      return;
    }
    await deleteFolder({ id: deleteTarget.id, action: deleteAcao });
    if (currentFolderId === deleteTarget.id) {
      setCurrentFolderId(null);
    }
    setDeleteTarget(null);
    setConfirmFolderName("");
    setDeleteAcao("move_to_root");
  };

  // Song Actions
  const handleCreateSongSubmit = async (data: {
    title: string;
    artist: string;
    folderId: string | null;
    tags: string[];
  }) => {
    try {
      const song = await createSong({
        title: data.title,
        artist: data.artist,
        folderId: data.folderId,
        content: `{title: ${data.title}}\n{artist: ${data.artist}}\n\n[G] Exemplo de tom e cifra...`,
        tags: data.tags,
      });
      setIsCreateSongModalOpen(false);
      navigate(`${slugPrefix}/songs/${song.id}`);
    } catch {
      // Error toast is already displayed by useSongMutations
    }
  };

  const handleCifraClubSubmit = async (
    chordpro: ConversionResult,
    artist: string,
    title: string,
  ) => {
    try {
      const song = await createSong({
        title,
        artist,
        folderId: currentFolderId,
        content: `{title: ${title}}\n{artist: ${artist}}\n\n${chordpro.chordpro}`,
        tags: ["cifraclub"],
      });
      await Promise.all([songsQuery.refetch(), foldersQuery.refetch()]);
      setIsCreateSongModalOpen(false);
      navigate(`${slugPrefix}/songs/${song.id}`);
    } catch {
      // Error toast is already displayed by useSongMutations
    }
  };

  const handleCreateServiceSubmit = async (data: {
    name: string;
    date: string;
    notes: string;
  }) => {
    try {
      const newService = await createService({
        name: data.name,
        date: data.date,
        notes: data.notes,
        elements: [],
      });
      setIsCreateServiceModalOpen(false);
      navigate(`${slugPrefix}/services/${newService.id}`);
    } catch {
      // Error toast is already displayed by useServices
    }
  };

  const handleDeleteSongSubmit = async () => {
    if (!deleteSongTarget) return;
    await deleteSong(deleteSongTarget.id);
    setDeleteSongTarget(null);
  };

  // Batch Operations,
  const handleBatchMoveConfirm = useCallback(
    async (targetFolderId: string | null) => {
      const folderList = Array.from(selectedFolderIds);
      const songList = Array.from(selectedSongIds);

      clearSelection();

      try {
        for (const fId of folderList) {
          const f = allFolders.find((x) => x.id === fId);
          if (f)
            await moveFolder({
              id: fId,
              parentId: targetFolderId,
              updatedAt: f.updatedAt!,
            });
        }
        for (const sId of songList) {
          const s = allSongs.find((x) => x.id === sId);
          if (s)
            await moveSong({
              id: sId,
              folderId: targetFolderId,
              updatedAt: s.updatedAt,
            });
        }

        showToast(
          t("layout.movedItems", {
            count: folderList.length + songList.length,
          }),
          "success",
        );
      } catch {
        showToast(t("layout.moveError"), "error");
      }
    },
    [
      selectedFolderIds,
      selectedSongIds,
      allFolders,
      allSongs,
      moveFolder,
      moveSong,
      showToast,
      clearSelection,
      t,
    ],
  );

  const handleBatchDeleteConfirm = async (
    folderAction: "move_to_root" | "delete_songs",
  ) => {
    const folderList = Array.from(selectedFolderIds);
    const songList = Array.from(selectedSongIds);

    for (const fId of folderList) {
      await deleteFolder({ id: fId, action: folderAction });
    }
    for (const sId of songList) {
      await deleteSong(sId);
    }

    showToast(
      t("layout.deletedItems", { count: folderList.length + songList.length }),
      "success",
    );
    clearSelection();
  };

  const handleBatchTagConfirm = async (
    tags: string[],
    mode: "append" | "replace" | "remove",
  ) => {
    const songList = Array.from(selectedSongIds);
    if (songList.length === 0) return;
    await updateBatchTags({ songIds: songList, tags, mode });
    clearSelection();
  };

  // File Upload
  const showToastImportResult = (result: ProviderImportResult) => {
    if (result.created > 0) {
      const targetFolderName = currentFolder
        ? currentFolder.name
        : t("layout.rootDirectory");
      showToast(
        t("layout.uploadSuccess", {
          count: result.created,
          type: result.fileTypeName,
          folder: targetFolderName,
        }),
        "success",
      );
    }

    if (result.failed > 0) {
      showToast(
        t("layout.uploadError", {
          count: result.failed,
          type: result.fileTypeName,
        }),
        "error",
      );
    }

    if (result.ignored > 0) {
      showToast(
        t("layout.uploadIgnored", {
          count: result.ignored,
          type: result.fileTypeName,
        }),
        "warning",
      );
    }
  };

  const processAndUploadFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploadingFiles(true);
    const result = await songImportRegistry.importFiles(fileList, {
      folderId: currentFolderId,
    });

    result.results.forEach((r) => {
      showToastImportResult(r);
    });

    await Promise.all([songsQuery.refetch(), foldersQuery.refetch()]);
    setIsUploadingFiles(false);
  };

  const handleChordProFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processAndUploadFiles(Array.from(files));
    }
    if (e.target) e.target.value = "";
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInternalDragActive) return;
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (isInternalDragActive) {
      setIsInternalDragActive(false);
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processAndUploadFiles(Array.from(files));
    }
  };

  const handleItemDragStart = useCallback(
    (e: React.DragEvent, id: string, type: "folder" | "song") => {
      const isSelected =
        type === "folder" ? selectedFolderIds.has(id) : selectedSongIds.has(id);

      if (!isSelected) {
        if (type === "folder") {
          setSelectedFolderIds(new Set([id]));
          setSelectedSongIds(new Set());
        } else {
          setSelectedFolderIds(new Set());
          setSelectedSongIds(new Set([id]));
        }
        setLastClickedId(id);
      }

      const willFolders =
        !isSelected && type === "folder"
          ? new Set([id])
          : isSelected
            ? selectedFolderIds
            : type === "folder"
              ? new Set([...selectedFolderIds, id])
              : selectedFolderIds;
      const willSongs =
        !isSelected && type === "song"
          ? new Set([id])
          : isSelected
            ? selectedSongIds
            : type === "song"
              ? new Set([...selectedSongIds, id])
              : selectedSongIds;
      const totalDragging = willFolders.size + willSongs.size;

      if (totalDragging > 1) {
        const ghost = document.createElement("div");
        ghost.style.cssText = [
          "position:fixed",
          "top:-2000px",
          "left:-2000px",
          "width:150px",
          "height:60px",
          "pointer-events:none",
          "z-index:9999",
        ].join(";");

        const stackCount = Math.min(totalDragging, 3);
        for (let i = stackCount - 1; i >= 0; i--) {
          const card = document.createElement("div");
          const rotation = (i - Math.floor(stackCount / 2)) * 4;
          const yOffset = i * -3;
          card.style.cssText = [
            "position:absolute",
            "width:140px",
            "height:44px",
            "background:white",
            "border:2px solid rgba(2,132,199,0.6)",
            "border-radius:14px",
            "box-shadow:0 4px 16px rgba(0,0,0,0.18)",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            `transform:rotate(${rotation}deg) translateY(${yOffset}px)`,
            "font-size:12px",
            "font-weight:800",
            "color:#0284c7",
            "letter-spacing:0.05em",
            "font-family:system-ui,sans-serif",
            `top:${(stackCount - 1 - i) * 3}px`,
            "left:0",
          ].join(";");
          if (i === 0) {
            card.textContent = t("layout.dragItems", { count: totalDragging });
          }
          ghost.appendChild(card);
        }

        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 70, 22);
        requestAnimationFrame(() => {
          if (document.body.contains(ghost)) document.body.removeChild(ghost);
        });
      }

      setIsInternalDragActive(true);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-app-internal-drag", "true");
    },
    [selectedFolderIds, selectedSongIds, t],
  );

  const handleItemDragEnd = useCallback(() => {
    setIsInternalDragActive(false);
    setDropTargetFolderId(null);
  }, []);

  const handleFolderDragOver = useCallback(
    (e: React.DragEvent, folderId: string) => {
      if (!isInternalDragActive) return;
      e.preventDefault();
      e.stopPropagation();

      if (disabledFolderIdsForBatchMove.has(folderId)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.dataTransfer.dropEffect = "move";
      setDropTargetFolderId(folderId);
    },
    [isInternalDragActive, disabledFolderIdsForBatchMove],
  );

  const handleFolderDragLeave = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.stopPropagation();
      setDropTargetFolderId((prev) => (prev === folderId ? null : prev));
    },
    [],
  );

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const wasInternalDrag = isInternalDragActive;
      setDropTargetFolderId(null);
      setIsInternalDragActive(false);

      if (!wasInternalDrag || disabledFolderIdsForBatchMove.has(folderId))
        return;

      await handleBatchMoveConfirm(folderId);
    },
    [
      isInternalDragActive,
      disabledFolderIdsForBatchMove,
      handleBatchMoveConfirm,
    ],
  );

  const totalItemsCount = filteredSubfolders.length + filteredFiles.length;

  const layoutContent = (
    <>
      <div className="h-dvh max-h-dvh w-full flex flex-row overflow-hidden bg-m3-bg">
        <AppSidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          organization={organization}
          organizations={organizations}
          onSwitchOrganization={handleSwitchOrganization}
          slugPrefix={slugPrefix}
          view={view}
          currentFolderId={currentFolderId}
          rootSongsCount={rootSongsCount}
          rootFoldersCount={rootFoldersCount}
          totalSongs={totalSongs}
          totalServices={totalServices}
          totalCollections={collections.length}
          trashCount={trashItems.length}
          eventCount={upcomingEventCount}
          allFolders={allFolders}
          folderTree={folderTree}
          expandedFolderIds={expandedFolderIds}
          showFolderTree={settings.showFolderTree}
          user={user}
          onSelectFolder={handleSelectFolder}
          onContextMenu={handleContextMenu}
          toggleExpand={toggleExpand}
          navigate={navigate}
          logout={logout}
        />

        {/* Main Container (Toolbar + Content) */}
        <div className="flex-1 flex flex-col p-2 sm:p-4 md:p-0 h-full w-full overflow-hidden">
          {/* Hidden File Input for Multiple ChordPro Uploads */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pro,.chordpro,.txt,.chopro"
            onChange={handleChordProFileUpload}
            className="hidden"
          />

          {/* Window Container */}
          <div
            className="bg-m3-card border md:border-none border-m3-border rounded-4xl md:rounded-none shadow-2xl md:shadow-none shadow-black/10 overflow-hidden flex flex-col flex-1 h-full transition-all duration-300"
            role="main"
          >
            <ExplorerAddressBar
              view={view}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              currentFolder={currentFolder}
              currentFolderId={currentFolderId}
              slugPrefix={slugPrefix}
              folderBreadcrumbs={folderBreadcrumbs}
              songBreadcrumbs={songBreadcrumbs}
              currentSong={currentSong}
              currentSongFileName={currentSongFileName}
              currentService={currentService}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onSelectFolder={handleSelectFolder}
              onNavigateBack={() => {
                if (view === "explorer") {
                  handleSelectFolder(currentFolder?.parentId || null);
                } else {
                  navigate(-1);
                }
              }}
              onOpenCreateCollection={() =>
                setIsCreateCollectionModalOpen(true)
              }
              navigate={navigate}
              onOpenCreateSong={() => setIsCreateSongModalOpen(true)}
              onOpenCifraImport={() => setIsCifraImportOpen(true)}
              onOpenCreateService={() => setIsCreateServiceModalOpen(true)}
              onOpenCreateFolder={() => setIsCreateModalOpen(true)}
            />

            <ExplorerToolbar
              view={view}
              activeFiltersCount={activeFiltersCount}
              showArchived={showArchived}
              setShowArchived={setShowArchived}
              archivedServices={archivedServices}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              density={density}
              onDensityChange={handleDensityChange}
              onOpenFilterPanel={() => {
                navigateBackToDrive();
                setIsFilterPanelOpen(true);
              }}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative bg-white dark:bg-m3-bg overflow-hidden">
              <Outlet
                context={{
                  filteredSubfolders,
                  filteredFiles,
                  viewMode,
                  density,
                  setDensity: handleDensityChange,
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
                  sortBy,
                  sortOrder,
                  hideHeader: true,
                  selectedKey,
                  selectedTag,
                  containerRef,
                  handleWorkspaceMouseDown,
                  handleCanvasContextMenu,
                  handleDragOver,
                  handleDragLeave,
                  handleDrop,
                  isDraggingOver,
                  totalItemsCount,
                  currentFolderId,
                  selectionBox,
                  isInternalDragActive,
                  dropTargetFolderId,
                  dragDisabledFolderIds: disabledFolderIdsForBatchMove,
                  handleItemDragStart,
                  handleItemDragEnd,
                  handleFolderDragOver,
                  handleFolderDragLeave,
                  handleFolderDrop,
                  showArchived,
                  setShowArchived,
                  archivedServices,
                  archivedServicesQuery,
                }}
              />
            </div>

            {/* Status Bar */}
            {view === "explorer" && (
              <div className="h-10 bg-m3-sidebar/40 border-t border-m3-border px-6 flex items-center justify-between text-[10px] text-m3-secondary font-black uppercase tracking-widest select-none">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                    {currentFolder
                      ? `/${currentFolder.name}`
                      : t("layout.rootLocation")}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span>
                    {t("layout.statusFolders", {
                      count: filteredSubfolders.length,
                    })}
                  </span>
                  <span>
                    {t("layout.statusFiles", { count: filteredFiles.length })}
                  </span>
                  <span className="text-m3-primary font-bold">
                    {t("layout.statusTotal", { count: totalItemsCount })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ToastContainer />

      <BatchActionFloatingBar
        selectedCount={totalSelectedCount}
        itemLabel={t("layout.items")}
        onPrint={() => {
          const sList = allSongs.filter((s) => selectedSongIds.has(s.id));
          const fList = allFolders
            .filter((f) => selectedFolderIds.has(f.id))
            .map((f) => ({
              folder: f,
              songs: allSongs
                .filter((s) => s.folderId === f.id)
                .sort((a, b) => {
                  if ((a.song_number || Infinity) < (b.song_number || Infinity))
                    return -1;
                  else if (
                    (a.song_number || Infinity) > (b.song_number || Infinity)
                  )
                    return 1;
                  return -1;
                }),
            }));

          if (sList.length > 0 && fList.length === 0) {
            printSongs(sList);
          } else if (fList.length > 0 && sList.length === 0) {
            printFolders(fList);
          } else {
            printBatch([
              ...fList.map((f) => ({
                type: "folder" as const,
                data: f.folder,
                songs: f.songs,
              })),
              ...sList.map((s) => ({
                type: "song" as const,
                data: s,
              })),
            ]);
          }
        }}
        onDelete={() => setIsBatchDeleteOpen(true)}
        onCancel={clearSelection}
      />

      <ExplorerContextMenu
        contextMenu={contextMenu}
        currentFolder={currentFolder}
        totalSelectedCount={totalSelectedCount}
        selectedSongIds={selectedSongIds}
        selectedFolderIds={selectedFolderIds}
        slugPrefix={slugPrefix}
        navigate={navigate}
        fileInputRef={fileInputRef}
        onClose={() => setContextMenu(null)}
        onOpenCreateFolder={() => setIsCreateModalOpen(true)}
        onOpenCreateSong={() => setIsCreateSongModalOpen(true)}
        onSelectAll={selectAllInCurrentView}
        onRefreshView={() => {
          foldersQuery.refetch();
          songsQuery.refetch();
        }}
        onOpenBatchTag={() => setIsBatchTagOpen(true)}
        onOpenBatchMove={() => setIsBatchMoveOpen(true)}
        onOpenBatchDelete={() => setIsBatchDeleteOpen(true)}
        onClearSelection={clearSelection}
        onSelectFolder={handleSelectFolder}
        onCustomizeFolder={setCustomizeTarget}
        onRenameFolder={setRenameTarget}
        onMoveFolder={(f) => {
          setMoveFolderTarget(f);
          setTargetParentFolderId(f.parentId || null);
        }}
        onDeleteFolder={setDeleteTarget}
        onMoveSong={(s) => {
          setMoveSongTarget(s);
          setTargetSongFolderId(s.folderId || null);
        }}
        onTagSong={(s) => {
          setSelectedSongIds(new Set([s.id]));
          setIsBatchTagOpen(true);
        }}
        onDeleteSong={setDeleteSongTarget}
        onPrintSong={(songId) => {
          const s = allSongs.find((x) => x.id === songId);
          if (s) printSong(s);
        }}
        onPrintFolder={(folderId) => {
          const f = allFolders.find((x) => x.id === folderId);
          if (f) {
            const fSongs = allSongs
              .filter((s) => s.folderId === folderId)
              .sort((a, b) => {
                if ((a.song_number || Infinity) < (b.song_number || Infinity))
                  return -1;
                else if (
                  (a.song_number || Infinity) > (b.song_number || Infinity)
                )
                  return 1;
                return -1;
              });
            printFolder(f, fSongs);
          }
        }}
        onPrintSongs={() => {
          const sList = allSongs.filter((s) => selectedSongIds.has(s.id));
          if (sList.length) printSongs(sList);
        }}
        onPrintFolders={() => {
          const fList = allFolders
            .filter((f) => selectedFolderIds.has(f.id))
            .map((f) => ({
              folder: f,
              songs: allSongs.filter((s) => s.folderId === f.id),
            }));
          if (fList.length) printFolders(fList);
        }}
      />

      <ExplorerModals
        isCifraImportOpen={isCifraImportOpen}
        setIsCifraImportOpen={setIsCifraImportOpen}
        onCifraClubSubmit={handleCifraClubSubmit}
        isCreateSongModalOpen={isCreateSongModalOpen}
        setIsCreateSongModalOpen={setIsCreateSongModalOpen}
        currentFolder={currentFolder}
        currentFolderId={currentFolderId}
        allFolders={allFolders}
        onCreateSongSubmit={handleCreateSongSubmit}
        isCreateServiceModalOpen={isCreateServiceModalOpen}
        setIsCreateServiceModalOpen={setIsCreateServiceModalOpen}
        onCreateServiceSubmit={handleCreateServiceSubmit}
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        onCreateFolderSubmit={handleCreateFolderSubmit}
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        onRenameFolderSubmit={handleRenameFolderSubmit}
        customizeTarget={customizeTarget}
        setCustomizeTarget={setCustomizeTarget}
        onCustomizeFolderSubmit={handleCustomizeFolderSubmit}
        moveFolderTarget={moveFolderTarget}
        setMoveFolderTarget={setMoveFolderTarget}
        targetParentFolderId={targetParentFolderId}
        setTargetParentFolderId={setTargetParentFolderId}
        folderTree={folderTree}
        expandedFolderIds={expandedFolderIds}
        toggleExpand={toggleExpand}
        onMoveFolderSubmit={handleMoveFolderSubmit}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteAcao={deleteAcao}
        setDeleteAcao={setDeleteAcao}
        confirmFolderName={confirmFolderName}
        setConfirmFolderName={setConfirmFolderName}
        onDeleteFolderSubmit={handleDeleteFolderSubmit}
        moveSongTarget={moveSongTarget}
        setMoveSongTarget={setMoveSongTarget}
        targetSongFolderId={targetSongFolderId}
        onMoveSongConfirm={async (targetFolderId) => {
          if (!moveSongTarget) return;
          try {
            await moveSong({
              id: moveSongTarget.id,
              folderId: targetFolderId,
              updatedAt: moveSongTarget.updatedAt,
            });
            setMoveSongTarget(null);
          } catch {
            // Toast error is handled by useSongMutations
          }
        }}
        deleteSongTarget={deleteSongTarget}
        setDeleteSongTarget={setDeleteSongTarget}
        onDeleteSongSubmit={handleDeleteSongSubmit}
        isBatchMoveOpen={isBatchMoveOpen}
        setIsBatchMoveOpen={setIsBatchMoveOpen}
        selectedFolderIds={selectedFolderIds}
        selectedSongIds={selectedSongIds}
        disabledFolderIdsForBatchMove={disabledFolderIdsForBatchMove}
        onBatchMoveConfirm={handleBatchMoveConfirm}
        isBatchDeleteOpen={isBatchDeleteOpen}
        setIsBatchDeleteOpen={setIsBatchDeleteOpen}
        selectedFolderObjects={selectedFolderObjects}
        onBatchDeleteConfirm={handleBatchDeleteConfirm}
        isBatchTagOpen={isBatchTagOpen}
        setIsBatchTagOpen={setIsBatchTagOpen}
        onBatchTagConfirm={handleBatchTagConfirm}
        isFilterPanelOpen={isFilterPanelOpen}
        setIsFilterPanelOpen={setIsFilterPanelOpen}
        currentQuery={searchQuery}
        onApplyQuery={handleSearchChange}
        availableTags={availableTags}
      />

      {/* Marquee rubberband drag selection box */}
      {selectionBox && (
        <div
          style={{
            position: "fixed",
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            pointerEvents: "none",
            zIndex: 100,
          }}
          className="border-2 border-[#0284c7] bg-[#0284c7]/25 rounded-lg shadow-xl backdrop-blur-[1px]"
        />
      )}
    </>
  );

  return (
    <HosannaCommandPalette
      slugPrefix={organization?.slug || ""}
      isDataLoading={
        songsQuery.isLoading ||
        foldersQuery.isLoading ||
        servicesQuery.isLoading
      }
      searchSongsDb={async (query) => {
        if (songsQuery.isLoading || !songsQuery.data?.songs) return [];
        const lowerQuery = query.toLowerCase().trim();
        const allSongsList = songsQuery.data.songs;
        const matches: Song[] = [];
        for (const song of allSongsList) {
          const matchTitle = song.title?.toLowerCase().includes(lowerQuery);
          const matchArtist = song.artist?.toLowerCase().includes(lowerQuery);
          const matchTags = song.tags?.some((t: string) =>
            t.toLowerCase().includes(lowerQuery),
          );

          if (matchTitle || matchArtist || matchTags) {
            matches.push(song);
            if (matches.length >= 8) break;
          }
        }
        return matches;
      }}
      searchFoldersDb={async (query) => {
        if (foldersQuery.isLoading || !foldersQuery.data?.folders) return [];
        const lowerQuery = query.toLowerCase().trim();
        const allFoldersList = foldersQuery.data.folders;
        const matches: Folder[] = [];
        for (const folder of allFoldersList) {
          if (folder.name?.toLowerCase().includes(lowerQuery)) {
            matches.push(folder);
            if (matches.length >= 5) break;
          }
        }
        return matches;
      }}
      searchServicesDb={async (query) => {
        const rawServices = servicesQuery.data;
        if (servicesQuery.isLoading || !Array.isArray(rawServices)) return [];
        const lowerQuery = query.toLowerCase().trim();
        const matches: Service[] = [];
        for (const service of rawServices) {
          const matchName = service.name?.toLowerCase().includes(lowerQuery);
          const matchNotes = service.notes?.toLowerCase().includes(lowerQuery);

          if (matchName || matchNotes) {
            matches.push(service);
            if (matches.length >= 5) break;
          }
        }
        return matches;
      }}
      getFolderPathString={getFolderPathString}
      navigate={navigate}
      logout={logout}
      currentFolderId={currentFolderId}
      currentSong={currentSong}
      currentService={currentService}
      view={view}
      isSidebarCollapsed={isSidebarCollapsed}
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      setCurrentFolderId={setCurrentFolderId}
      setIsCreateSongModalOpen={setIsCreateSongModalOpen}
      setIsCifraImportOpen={setIsCifraImportOpen}
      setIsCreateServiceModalOpen={setIsCreateServiceModalOpen}
      setIsCreateModalOpen={setIsCreateModalOpen}
      setIsFilterPanelOpen={setIsFilterPanelOpen}
      handleViewModeChange={handleViewModeChange}
      handlePrintSong={() => {}}
      setMoveSongTarget={setMoveSongTarget}
      setTargetSongFolderId={setTargetSongFolderId}
      setDeleteSongTarget={setDeleteSongTarget}
      deleteService={deleteService}
      fileInputRef={fileInputRef}
    >
      {layoutContent}
    </HosannaCommandPalette>
  );
};
