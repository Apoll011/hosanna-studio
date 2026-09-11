/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Collection, Folder, Song } from "@/src/types";
import { ConversionResult } from "@hosanna/chordpro";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Music,
  RotateCcw,
  Search,
  Sliders,
  Tag,
  X,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import {
  FolderTreeNode,
  getFolderDescendantIds,
  MoveFolderTreeItem,
} from "../explorer";
import { FolderForm } from "../forms/FolderForm";
import { ServiceForm } from "../forms/ServiceForm";
import { SongForm } from "../forms/SongForm";
import { AddToCollectionModal } from "../modals/AddToCollectionModal";
import { BatchDeleteModal } from "../modals/BatchDeleteModal";
import { BatchMoveModal } from "../modals/BatchMoveModal";
import { BatchTagModal } from "../modals/BatchTagModal";
import { CifraClubImportModal } from "../modals/CifraModal";
import { CreateCollectionModal } from "../modals/CreateCollectionModal";
import { CustomizeFolderModal } from "../modals/CustomizeFolderModal";
import { MoveSongModal } from "../modals/MoveSongModal";

// ─── Musical keys ───────────────────────────────────────────────────────────
const MUSICAL_KEYS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
  "Am",
  "Bm",
  "Cm",
  "Dm",
  "Em",
  "Fm",
  "Gm",
];

// ─── Helper: parse existing Liqe query and remove/toggle a clause ────────────
function addLiqeClause(query: string, clause: string): string {
  const trimmed = query.trim();
  if (!trimmed) return clause;
  // If exact clause already present, remove it (toggle)
  if (trimmed.includes(clause)) {
    return trimmed
      .replace(clause, "")
      .replace(/\s+AND\s+/g, " AND ")
      .replace(/^\s*AND\s+|\s+AND\s*$/g, "")
      .trim();
  }
  return `${trimmed} AND ${clause}`;
}

function removeLiqeClause(query: string, prefix: string): string {
  // Remove any existing clause that starts with the given prefix
  return query
    .split(/\s+AND\s+/i)
    .filter(
      (part) => !part.trim().toLowerCase().startsWith(prefix.toLowerCase()),
    )
    .join(" AND ")
    .trim();
}

function hasClause(query: string, clause: string): boolean {
  return query.includes(clause);
}

function getClauseValue(query: string, field: string): string | null {
  const regex = new RegExp(`\\b${field}:([^\\s]+|"[^"]*")`, "i");
  const match = query.match(regex);
  return match ? match[1].replace(/"/g, "") : null;
}

// ─── FilterSection: collapsible group ───────────────────────────────────────
const FilterSection: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ icon, label, active, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-m3-border rounded-2xl overflow-hidden bg-m3-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={active ? "text-m3-primary" : "text-m3-secondary"}>
            {icon}
          </span>
          <span className={active ? "text-m3-primary" : ""}>{label}</span>
          {active && (
            <span className="w-2 h-2 rounded-full bg-m3-primary inline-block" />
          )}
        </div>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-m3-secondary" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-m3-secondary" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-m3-border/50">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Chip button ─────────────────────────────────────────────────────────────
const Chip: React.FC<{
  label: string;
  selected?: boolean;
  onClick: () => void;
}> = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer border transition-all ${
      selected
        ? "bg-m3-primary text-white border-m3-primary shadow-sm shadow-m3-primary/30"
        : "bg-m3-card text-m3-secondary border-m3-border hover:border-m3-primary/50 hover:text-m3-primary"
    }`}
  >
    {label}
  </button>
);

// ─── Advanced Filter Panel ───────────────────────────────────────────────────
interface AdvancedFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuery: string;
  onApplyQuery: (query: string) => void;
  availableTags: string[];
  availableFolders: Folder[];
  currentFolder?: Folder;
}

const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  isOpen,
  onClose,
  currentQuery,
  onApplyQuery,
  availableTags,
  availableFolders,
  currentFolder,
}) => {
  const { t } = useI18n();

  // Local draft state — only committed on "Apply"
  const [draft, setDraft] = useState(currentQuery);

  // Sync draft when modal opens with latest query
  React.useEffect(() => {
    if (isOpen) setDraft(currentQuery);
  }, [isOpen, currentQuery]);

  // Active detected values
  const activeTags = useMemo(
    () =>
      availableTags.filter((tag) =>
        hasClause(draft, `tags:${tag.includes(" ") ? `"${tag}"` : tag}`),
      ),
    [draft, availableTags],
  );
  const activeKey = useMemo(() => getClauseValue(draft, "key"), [draft]);
  const activeFolder = useMemo(() => getClauseValue(draft, "folder"), [draft]);

  const toggleTag = useCallback((tag: string) => {
    const clause = tag.includes(" ") ? `tags:"${tag}"` : `tags:${tag}`;
    setDraft((q) =>
      hasClause(q, clause)
        ? removeLiqeClause(q, `tags:${tag.includes(" ") ? `"${tag}"` : tag}`)
        : addLiqeClause(q, clause),
    );
  }, []);

  const toggleKey = useCallback((key: string) => {
    setDraft((q) => {
      const existing = getClauseValue(q, "key");
      const cleaned = removeLiqeClause(q, "key:");
      if (existing === key) return cleaned; // deselect
      return addLiqeClause(cleaned, `key:${key}`);
    });
  }, []);

  const toggleFolder = useCallback((folderName: string) => {
    setDraft((q) => {
      const existing = getClauseValue(q, "folder");
      const cleaned = removeLiqeClause(q, "folder:");
      if (existing === folderName) return cleaned;
      return addLiqeClause(
        cleaned,
        folderName.includes(" ")
          ? `folder:"${folderName}"`
          : `folder:${folderName}`,
      );
    });
  }, []);

  const handleApply = useCallback(() => {
    onApplyQuery(draft);
    onClose();
  }, [draft, onApplyQuery, onClose]);

  const handleClear = useCallback(() => {
    setDraft("");
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("explorer.modals.filterTitle")}
    >
      <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
        {/* Live query preview */}
        <div className="flex items-center gap-2 p-3 bg-m3-sidebar/40 border border-m3-border rounded-2xl">
          <Search className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Liqe query preview — edit freely…"
            className="flex-1 bg-transparent text-xs text-m3-text placeholder:text-m3-secondary/60 outline-none font-mono"
            spellCheck={false}
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              className="text-m3-secondary hover:text-m3-text transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {currentFolder && (
          <p className="text-[11px] text-m3-secondary px-1">
            {t("explorer.modals.searchScope")}{" "}
            <span className="font-bold text-m3-primary">
              {currentFolder.name}
            </span>
          </p>
        )}

        {/* ── Tags ──────────────────────────────────────────────────── */}
        {availableTags.length > 0 && (
          <FilterSection
            icon={<Tag className="w-3.5 h-3.5" />}
            label={t("explorer.modals.categoryTag")}
            active={activeTags.length > 0}
            defaultOpen={activeTags.length > 0}
          >
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
              {availableTags.map((tag) => {
                const clause = tag.includes(" ")
                  ? `tags:"${tag}"`
                  : `tags:${tag}`;
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={hasClause(draft, clause)}
                    onClick={() => toggleTag(tag)}
                  />
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* ── Musical Key ───────────────────────────────────────────── */}
        <FilterSection
          icon={<Music className="w-3.5 h-3.5" />}
          label="Tonalidade / Key"
          active={!!activeKey}
          defaultOpen={!!activeKey}
        >
          <div className="flex flex-wrap gap-1.5 mt-2">
            {MUSICAL_KEYS.map((key) => (
              <Chip
                key={key}
                label={key}
                selected={activeKey === key}
                onClick={() => toggleKey(key)}
              />
            ))}
          </div>
        </FilterSection>

        {/* ── Folder ────────────────────────────────────────────────── */}
        {availableFolders.length > 0 && (
          <FilterSection
            icon={<HardDrive className="w-3.5 h-3.5" />}
            label="Pasta / Folder"
            active={!!activeFolder}
            defaultOpen={!!activeFolder}
          >
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
              {availableFolders.map((folder) => (
                <Chip
                  key={folder.id}
                  label={folder.name}
                  selected={activeFolder === folder.name}
                  onClick={() => toggleFolder(folder.name)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* ── Quick field selectors ─────────────────────────────────── */}
        <FilterSection
          icon={<Search className="w-3.5 h-3.5" />}
          label="Pesquisa por campo / Field search"
          active={
            hasClause(draft, "title:") ||
            hasClause(draft, "artist:") ||
            hasClause(draft, "content:") ||
            hasClause(draft, "tempo:") ||
            hasClause(draft, "year:")
          }
        >
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-m3-secondary leading-relaxed">
              Clique num campo para adicionar um prefixo de pesquisa ao query.{" "}
              <br />
              Edite o valor diretamente no campo de query acima.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["title", "Título"],
                  ["artist", "Artista"],
                  ["content", "Letra / Conteúdo"],
                  ["year", "Ano"],
                  ["tempo", "Tempo (BPM)"],
                  ["album", "Álbum"],
                  ["composer", "Compositor"],
                  ["ccli", "CCLI"],
                ] as const
              ).map(([field, label]) => (
                <button
                  key={field}
                  type="button"
                  onClick={() =>
                    setDraft((q) => {
                      const base = q.trim();
                      const prefix = base
                        ? `${base} AND ${field}:`
                        : `${field}:`;
                      return prefix;
                    })
                  }
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer border transition-all bg-m3-card text-m3-secondary border-m3-border hover:border-m3-primary/50 hover:text-m3-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </FilterSection>

        {/* ── Range helpers ─────────────────────────────────────────── */}
        <FilterSection
          icon={<Sliders className="w-3.5 h-3.5" />}
          label="Intervalos / Ranges"
          active={
            hasClause(draft, "year:[") ||
            hasClause(draft, "tempo:[") ||
            hasClause(draft, "duration:[")
          }
        >
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-m3-secondary">
              Presets rápidos — clicar adiciona o intervalo ao query.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["Clássicos (< 1980)", "year:[* TO 1979]"],
                  ["Anos 80–90", "year:[1980 TO 1999]"],
                  ["Anos 2000+", "year:[2000 TO *]"],
                  ["Lento (< 80 BPM)", "tempo:[* TO 79]"],
                  ["Moderado (80–120)", "tempo:[80 TO 120]"],
                  ["Rápido (> 120)", "tempo:[121 TO *]"],
                  ["Curto (< 3 min)", "duration:[* TO 179]"],
                  ["Longo (> 5 min)", "duration:[300 TO *]"],
                ] as const
              ).map(([label, clause]) => (
                <button
                  key={clause}
                  type="button"
                  onClick={() => setDraft((q) => addLiqeClause(q, clause))}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer border transition-all ${
                    hasClause(draft, clause)
                      ? "bg-m3-primary text-white border-m3-primary"
                      : "bg-m3-card text-m3-secondary border-m3-border hover:border-m3-primary/50 hover:text-m3-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-m3-border">
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 text-xs font-semibold text-m3-secondary hover:text-m3-text transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t("explorer.modals.clearFilters")}
        </button>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleApply}
          >
            {t("explorer.modals.applyFilters")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface ExplorerModalsProps {
  // CifraClub
  isCifraImportOpen: boolean;
  setIsCifraImportOpen: (v: boolean) => void;
  onCifraClubSubmit: (
    chordpro: ConversionResult,
    artist: string,
    title: string,
  ) => Promise<void>;

  // Create Song
  isCreateSongModalOpen: boolean;
  setIsCreateSongModalOpen: (v: boolean) => void;
  currentFolder: Folder | undefined;
  currentFolderId: string | null;
  allFolders: Folder[];
  onCreateSongSubmit: (data: {
    title: string;
    artist: string;
    folderId: string | null;
    tags: string[];
  }) => Promise<void>;

  // Create Service
  isCreateServiceModalOpen: boolean;
  setIsCreateServiceModalOpen: (v: boolean) => void;
  onCreateServiceSubmit: (data: {
    name: string;
    date: string;
    notes: string;
  }) => Promise<void>;

  // Create Folder
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  onCreateFolderSubmit: (name: string) => Promise<void>;

  // Rename Folder
  renameTarget: Folder | null;
  setRenameTarget: (f: Folder | null) => void;
  onRenameFolderSubmit: (name: string) => Promise<void>;

  // Customize Folder
  customizeTarget?: Folder | null;
  setCustomizeTarget?: (f: Folder | null) => void;
  onCustomizeFolderSubmit?: (color: string, icon: string) => Promise<void>;

  // Move Folder
  moveFolderTarget: Folder | null;
  setMoveFolderTarget: (f: Folder | null) => void;
  targetParentFolderId: string | null;
  setTargetParentFolderId: (id: string | null) => void;
  folderTree: FolderTreeNode[];
  expandedFolderIds: Set<string>;
  toggleExpand: (id: string) => void;
  onMoveFolderSubmit: () => Promise<void>;

  // Delete Folder
  deleteTarget: Folder | null;
  setDeleteTarget: (f: Folder | null) => void;
  deleteAcao: "move_to_root" | "delete_songs";
  setDeleteAcao: (a: "move_to_root" | "delete_songs") => void;
  confirmFolderName: string;
  setConfirmFolderName: (n: string) => void;
  onDeleteFolderSubmit: () => Promise<void>;

  // Move Song
  moveSongTarget: Song | null;
  setMoveSongTarget: (s: Song | null) => void;
  targetSongFolderId: string | null;
  onMoveSongConfirm: (targetFolderId: string | null) => Promise<void>;

  // Delete Song
  deleteSongTarget: Song | null;
  setDeleteSongTarget: (s: Song | null) => void;
  onDeleteSongSubmit: () => Promise<void>;

  // Batch modals
  isBatchMoveOpen: boolean;
  setIsBatchMoveOpen: (v: boolean) => void;
  selectedFolderIds: Set<string>;
  selectedSongIds: Set<string>;
  disabledFolderIdsForBatchMove: Set<string>;
  onBatchMoveConfirm: (targetFolderId: string | null) => Promise<void>;

  isBatchDeleteOpen: boolean;
  setIsBatchDeleteOpen: (v: boolean) => void;
  selectedFolderObjects: Folder[];
  onBatchDeleteConfirm: (
    folderAction: "move_to_root" | "delete_songs",
  ) => Promise<void>;

  isBatchTagOpen: boolean;
  setIsBatchTagOpen: (v: boolean) => void;
  onBatchTagConfirm: (
    tags: string[],
    mode: "append" | "replace" | "remove",
  ) => Promise<void>;

  // Advanced Filter Modal — now Liqe-based
  isFilterPanelOpen: boolean;
  setIsFilterPanelOpen: (v: boolean) => void;
  currentQuery: string;
  onApplyQuery: (query: string) => void;
  availableTags: string[];

  // Create Collection
  isCreateCollectionModalOpen?: boolean;
  setIsCreateCollectionModalOpen?: (v: boolean) => void;
  onCreateCollectionSubmit?: (data: {
    name: string;
    description?: string | null;
    color?: string;
    icon?: string;
    image?: string | null;
  }) => Promise<void>;

  // Add to Collection
  addToCollectionTarget?: Song | null;
  setAddToCollectionTarget?: (s: Song | null) => void;
  isBatchAddToCollectionOpen?: boolean;
  setIsBatchAddToCollectionOpen?: (v: boolean) => void;
  allCollections?: Collection[];
  onAddToCollectionConfirm?: (collectionId: string) => Promise<void>;
  onOpenCreateCollectionFromAdd?: () => void;
}

export const ExplorerModals: React.FC<ExplorerModalsProps> = ({
  isCifraImportOpen,
  setIsCifraImportOpen,
  onCifraClubSubmit,
  isCreateSongModalOpen,
  setIsCreateSongModalOpen,
  currentFolder,
  currentFolderId,
  allFolders,
  onCreateSongSubmit,
  isCreateServiceModalOpen,
  setIsCreateServiceModalOpen,
  onCreateServiceSubmit,
  isCreateModalOpen,
  setIsCreateModalOpen,
  onCreateFolderSubmit,
  renameTarget,
  setRenameTarget,
  onRenameFolderSubmit,
  customizeTarget,
  setCustomizeTarget,
  onCustomizeFolderSubmit,
  moveFolderTarget,
  setMoveFolderTarget,
  targetParentFolderId,
  setTargetParentFolderId,
  folderTree,
  expandedFolderIds,
  toggleExpand,
  onMoveFolderSubmit,
  deleteTarget,
  setDeleteTarget,
  deleteAcao,
  setDeleteAcao,
  confirmFolderName,
  setConfirmFolderName,
  onDeleteFolderSubmit,
  moveSongTarget,
  setMoveSongTarget,
  targetSongFolderId,
  onMoveSongConfirm,
  deleteSongTarget,
  setDeleteSongTarget,
  onDeleteSongSubmit,
  isBatchMoveOpen,
  setIsBatchMoveOpen,
  selectedFolderIds,
  selectedSongIds,
  disabledFolderIdsForBatchMove,
  onBatchMoveConfirm,
  isBatchDeleteOpen,
  setIsBatchDeleteOpen,
  selectedFolderObjects,
  onBatchDeleteConfirm,
  isBatchTagOpen,
  setIsBatchTagOpen,
  onBatchTagConfirm,
  isFilterPanelOpen,
  setIsFilterPanelOpen,
  currentQuery,
  onApplyQuery,
  availableTags,
  isCreateCollectionModalOpen = false,
  setIsCreateCollectionModalOpen,
  onCreateCollectionSubmit,
  addToCollectionTarget,
  setAddToCollectionTarget,
  isBatchAddToCollectionOpen = false,
  setIsBatchAddToCollectionOpen,
  allCollections = [],
  onAddToCollectionConfirm,
  onOpenCreateCollectionFromAdd,
}) => {
  const { t } = useI18n();

  return (
    <>
      <CifraClubImportModal
        isOpen={isCifraImportOpen}
        handleClose={() => setIsCifraImportOpen(false)}
        handleSave={onCifraClubSubmit}
      />

      {/* CREATE SONG MODAL */}
      <Modal
        isOpen={isCreateSongModalOpen}
        onClose={() => setIsCreateSongModalOpen(false)}
        title={
          currentFolder
            ? t("explorer.modals.createSongInFolder", {
                folder: currentFolder.name,
              })
            : t("explorer.modals.createSongInRoot")
        }
      >
        <SongForm
          initialValues={{ folderId: currentFolderId }}
          folders={allFolders}
          onSubmit={onCreateSongSubmit}
          onCancel={() => setIsCreateSongModalOpen(false)}
        />
      </Modal>

      {/* CREATE SERVICE MODAL */}
      <Modal
        isOpen={isCreateServiceModalOpen}
        onClose={() => setIsCreateServiceModalOpen(false)}
        title={t("explorer.modals.createServiceTitle")}
      >
        <ServiceForm
          onSubmit={onCreateServiceSubmit}
          onCancel={() => setIsCreateServiceModalOpen(false)}
        />
      </Modal>

      {/* CREATE FOLDER MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          currentFolder
            ? t("explorer.modals.createFolderInFolder", {
                folder: currentFolder.name,
              })
            : t("explorer.modals.createFolderInRoot")
        }
      >
        <FolderForm
          onSubmit={onCreateFolderSubmit}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* RENAME FOLDER MODAL */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title={t("explorer.modals.renameFolderTitle", {
          folder: renameTarget?.name || "",
        })}
      >
        <FolderForm
          initialName={renameTarget?.name || ""}
          title={t("explorer.modals.updateFolderName")}
          onSubmit={onRenameFolderSubmit}
          onCancel={() => setRenameTarget(null)}
        />
      </Modal>

      {/* CUSTOMIZE FOLDER MODAL */}
      {customizeTarget && setCustomizeTarget && onCustomizeFolderSubmit && (
        <CustomizeFolderModal
          isOpen={!!customizeTarget}
          folder={customizeTarget}
          onClose={() => setCustomizeTarget(null)}
          onSave={onCustomizeFolderSubmit}
        />
      )}

      {/* MOVE FOLDER MODAL (TREE HIERARCHY) */}
      <Modal
        isOpen={!!moveFolderTarget}
        onClose={() => setMoveFolderTarget(null)}
        title={t("explorer.modals.moveFolderTitle", {
          folder: moveFolderTarget?.name || "",
        })}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("explorer.modals.selectDestFolder")}{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {moveFolderTarget?.name}
            </strong>
            :
          </p>

          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input
                type="radio"
                name="targetFolderParent"
                value="root"
                checked={targetParentFolderId === null}
                onChange={() => setTargetParentFolderId(null)}
                className="text-[#0284c7] focus:ring-[#0284c7]"
              />
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <HardDrive className="w-4 h-4 text-[#0284c7]" />
                <span>{t("explorer.modals.rootTopLevel")}</span>
              </div>
            </label>

            {/* Hierarchical Tree of Folders with Disabled Check for Self/Descendants */}
            <div className="flex flex-col gap-1.5 mt-1">
              {folderTree.map((node) => (
                <MoveFolderTreeItem
                  key={node.folder.id}
                  node={node}
                  selectedFolderId={targetParentFolderId}
                  onSelect={setTargetParentFolderId}
                  disabledFolderIds={
                    moveFolderTarget
                      ? getFolderDescendantIds(moveFolderTarget.id, allFolders)
                      : undefined
                  }
                  expandedFolderIds={expandedFolderIds}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setMoveFolderTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={onMoveFolderSubmit}>
              {t("explorer.modals.moveFolderBtn")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* DELETE FOLDER MODAL */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setConfirmFolderName("");
          setDeleteAcao("move_to_root");
        }}
        title={t("explorer.modals.deleteFolderTitle", {
          folder: deleteTarget?.name || "",
        })}
      >
        {(deleteTarget?.folderCount || 0) + (deleteTarget?.songCount || 0) >
        0 ? (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <span>{t("explorer.modals.selectDeleteFolderOption")}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="deleteAcao"
                  value="move_to_root"
                  checked={deleteAcao === "move_to_root"}
                  onChange={() => {
                    setDeleteAcao("move_to_root");
                    setConfirmFolderName("");
                  }}
                  className="text-[#0284c7] focus:ring-[#0284c7]"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t("explorer.modals.moveContentsToRoot")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t("explorer.modals.moveContentsToRootDesc")}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-rose-200 dark:border-rose-950 rounded-xl cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/20">
                <input
                  type="radio"
                  name="deleteAcao"
                  value="delete_songs"
                  checked={deleteAcao === "delete_songs"}
                  onChange={() => setDeleteAcao("delete_songs")}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {t("explorer.modals.deleteFolderAndContents")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t("explorer.modals.deleteFolderAndContentsDesc")}
                  </span>
                </div>
              </label>
            </div>

            {deleteAcao === "delete_songs" && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex flex-col gap-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{t("explorer.modals.additionalSecurity")}</span>
                </div>
                <p className="text-rose-900 dark:text-rose-200 text-[11px] leading-relaxed">
                  {t("explorer.modals.deleteFolderIrreversible")}{" "}
                  <strong className="font-extrabold underline">
                    {deleteTarget?.name}
                  </strong>{" "}
                  abaixo:
                </p>
                <Input
                  placeholder={t("explorer.modals.writeToConfirm", {
                    name: deleteTarget?.name || "",
                  })}
                  value={confirmFolderName}
                  onChange={(e) => setConfirmFolderName(e.target.value)}
                  className="bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmFolderName("");
                  setDeleteAcao("move_to_root");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={
                  deleteAcao === "delete_songs" &&
                  confirmFolderName.trim() !== deleteTarget?.name?.trim()
                }
                onClick={onDeleteFolderSubmit}
              >
                {t("explorer.modals.confirmDelete")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t("explorer.modals.emptyFolderDelete")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t("explorer.modals.emptyFolderDeleteDesc")}
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeleteTarget(null);
                    setConfirmFolderName("");
                    setDeleteAcao("move_to_root");
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="danger"
                  disabled={
                    deleteAcao === "delete_songs" &&
                    confirmFolderName.trim() !== deleteTarget?.name?.trim()
                  }
                  onClick={onDeleteFolderSubmit}
                >
                  {t("explorer.modals.confirmDelete")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MOVE SONG MODAL (TREE HIERARCHY) */}
      <MoveSongModal
        isOpen={!!moveSongTarget}
        onClose={() => setMoveSongTarget(null)}
        songTitle={moveSongTarget?.title}
        initialFolderId={targetSongFolderId}
        folders={allFolders}
        onConfirm={onMoveSongConfirm}
      />

      {/* DELETE SONG MODAL */}
      <Modal
        isOpen={!!deleteSongTarget}
        onClose={() => setDeleteSongTarget(null)}
        title={t("explorer.modals.deleteSongTitle", {
          title: deleteSongTarget?.title || "",
        })}
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>
              {t("explorer.modals.deleteSongWarning", {
                title: deleteSongTarget?.title || "",
              })}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setDeleteSongTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={onDeleteSongSubmit}>
              {t("explorer.modals.deleteSongBtn")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* BATCH MOVE MODAL */}
      <BatchMoveModal
        isOpen={isBatchMoveOpen}
        onClose={() => setIsBatchMoveOpen(false)}
        selectedFoldersCount={selectedFolderIds.size}
        selectedSongsCount={selectedSongIds.size}
        disabledFolderIds={disabledFolderIdsForBatchMove}
        folders={allFolders}
        onConfirm={onBatchMoveConfirm}
      />

      {/* BATCH DELETE MODAL */}
      <BatchDeleteModal
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        selectedFolders={selectedFolderObjects}
        selectedSongsCount={selectedSongIds.size}
        onConfirm={onBatchDeleteConfirm}
      />

      {/* BATCH TAG MODAL */}
      <BatchTagModal
        isOpen={isBatchTagOpen}
        onClose={() => setIsBatchTagOpen(false)}
        selectedSongIds={Array.from(selectedSongIds)}
        onConfirm={onBatchTagConfirm}
      />

      {/* ADVANCED FILTER MODAL — Liqe query builder */}
      <AdvancedFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        currentQuery={currentQuery}
        onApplyQuery={onApplyQuery}
        availableTags={availableTags}
        availableFolders={allFolders}
        currentFolder={currentFolder}
      />

      {/* CREATE COLLECTION MODAL */}
      {onCreateCollectionSubmit && setIsCreateCollectionModalOpen && (
        <CreateCollectionModal
          isOpen={isCreateCollectionModalOpen}
          onClose={() => setIsCreateCollectionModalOpen(false)}
          onSave={onCreateCollectionSubmit}
        />
      )}

      {/* ADD TO COLLECTION MODAL (SINGLE SONG) */}
      {addToCollectionTarget &&
        setAddToCollectionTarget &&
        onAddToCollectionConfirm && (
          <AddToCollectionModal
            isOpen={!!addToCollectionTarget}
            onClose={() => setAddToCollectionTarget(null)}
            collections={allCollections}
            songTitle={addToCollectionTarget.title}
            onConfirm={onAddToCollectionConfirm}
            onCreateNewCollection={onOpenCreateCollectionFromAdd}
          />
        )}

      {/* ADD TO COLLECTION MODAL (BATCH SONGS) */}
      {isBatchAddToCollectionOpen &&
        setIsBatchAddToCollectionOpen &&
        onAddToCollectionConfirm && (
          <AddToCollectionModal
            isOpen={isBatchAddToCollectionOpen}
            onClose={() => setIsBatchAddToCollectionOpen(false)}
            collections={allCollections}
            songCount={selectedSongIds.size}
            onConfirm={onAddToCollectionConfirm}
            onCreateNewCollection={onOpenCreateCollectionFromAdd}
          />
        )}
    </>
  );
};
