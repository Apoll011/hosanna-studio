/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Input } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { posthog } from "@/src/lib/posthog";
import { Folder, Service, Song } from "@/src/types";
import {
  Calendar,
  Calendar1,
  CalendarPlus,
  ChevronRight,
  CornerLeftUp,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  HardDrive,
  HelpCircle,
  LibraryBig,
  Menu,
  Music,
  Music2,
  Plus,
  Search,
  Settings,
  Trash2Icon,
  Users,
  X,
} from "lucide-react";
import { ActiveModal } from "./ExplorerModals";
import React, { useEffect, useRef, useState } from "react";
import { ViewName } from "../../layouts/view";
import { authClient } from "../../lib/authClient";
import { Can, CanAny } from "../../lib/permissions/components";
import { InboxButton, InboxFetchClient } from "../Inbox";
import { SearchSyntaxModal } from "../modals/SearchSyntaxModal";
import { SyncStatusBadge } from "../SyncStatusBadge";

interface ExplorerAddressBarProps {
  view: ViewName;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  currentFolder: Folder | undefined;
  currentFolderId: string | null;
  slugPrefix: string;
  folderBreadcrumbs: Folder[];
  songBreadcrumbs: Folder[];
  currentSong: Song | undefined;
  currentSongFileName: string;
  currentService: Service | undefined;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectFolder: (id: string | null) => void;
  onNavigateBack: () => void;
  navigate: (path: string) => void;
  onOpenModal: (modal: ActiveModal) => void;
}

export const ExplorerAddressBar: React.FC<ExplorerAddressBarProps> = ({
  view,
  isSidebarOpen,
  setIsSidebarOpen,
  currentFolder,
  currentFolderId,
  slugPrefix,
  folderBreadcrumbs,
  songBreadcrumbs,
  currentSong,
  currentSongFileName,
  currentService,
  searchQuery,
  onSearchChange,
  onSelectFolder,
  onNavigateBack,
  navigate,
  onOpenModal,
}) => {
  const { t, locale } = useI18n();
  const isDriveRoot = view === "explorer" && currentFolderId === null;
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const collections_enabled = posthog.isFeatureEnabled("collection") || false;

  return (
    <div className="relative p-3 sm:p-4 bg-m3-sidebar/40 border-b border-m3-border/50 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
      {/* Navigation Controls & Address Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full md:w-auto">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden p-2.5 rounded-2xl border transition-all text-m3-primary border-m3-primary/30 hover:bg-m3-primary hover:text-white bg-m3-card cursor-pointer shadow-sm shrink-0"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        {/* Up / Back Button */}
        <button
          onClick={onNavigateBack}
          disabled={isDriveRoot}
          title={
            view === "explorer"
              ? currentFolderId === null
                ? t("addressBar.atRootLevel")
                : currentFolder?.parentId
                  ? t("addressBar.upOneLevel")
                  : t("addressBar.upToRoot")
              : t("addressBar.back")
          }
          className={`p-2.5 rounded-2xl border transition-all ${
            isDriveRoot
              ? "text-m3-secondary/30 bg-m3-bg border-m3-border/30 cursor-not-allowed opacity-50"
              : "text-m3-primary border-m3-primary/30 hover:bg-m3-primary hover:text-white bg-m3-card cursor-pointer shadow-sm hover:shadow-m3-primary/20"
          }`}
        >
          <CornerLeftUp className="w-4.5 h-4.5" />
        </button>

        {/* Address Path Bar */}
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-m3-bg border border-m3-border rounded-2xl text-[13px] overflow-x-auto select-none hide-scrollbar shadow-inner min-w-0">
          <button
            onClick={() => {
              onSelectFolder(null);
              navigate(`${slugPrefix}/folders`);
            }}
            className={`flex items-center gap-2 font-black tracking-widest transition-all cursor-pointer shrink-0 ${
              isDriveRoot
                ? "text-m3-primary"
                : "text-m3-secondary hover:text-m3-text"
            }`}
          >
            <HardDrive
              className={`w-4 h-4 ${
                isDriveRoot ? "text-m3-primary" : "text-m3-secondary"
              }`}
            />
            <span>{t("common.home")}</span>
          </button>

          {view === "explorer" &&
            folderBreadcrumbs.map((folder, index) => {
              const isLast = index === folderBreadcrumbs.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  {isLast ? (
                    <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                      <FolderOpen className="w-4 h-4" />
                      <span>{folder.name}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectFolder(folder.id)}
                      className="flex items-center gap-2 font-bold text-m3-secondary hover:text-m3-text transition-all cursor-pointer shrink-0"
                    >
                      <FolderIcon className="w-4 h-4 opacity-70" />
                      <span>{folder.name}</span>
                    </button>
                  )}
                </React.Fragment>
              );
            })}

          {view === "songs" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Music className="w-4 h-4" />
                <span>{t("common.library")}</span>
              </div>
            </>
          )}

          {view === "song-editor" && (
            <>
              {songBreadcrumbs.map((folder) => (
                <React.Fragment key={folder.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <button
                    onClick={() => {
                      onSelectFolder(folder.id);
                      navigate(`${slugPrefix}/folders`);
                    }}
                    className="flex items-center gap-2 font-bold text-m3-secondary hover:text-m3-text transition-all cursor-pointer shrink-0"
                  >
                    <FolderIcon className="w-4 h-4 opacity-70" />
                    <span>{folder.name}</span>
                  </button>
                </React.Fragment>
              ))}

              {currentSong && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                    <FileText className="w-4 h-4" />
                    <span>{currentSongFileName}</span>
                  </div>
                </>
              )}
            </>
          )}

          {view === "services" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Calendar className="w-4 h-4" />
                <span>{t("common.services")}</span>
              </div>
            </>
          )}

          {view === "service-editor" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <button
                onClick={() => navigate(`${slugPrefix}/services`)}
                className="flex items-center gap-2 font-bold text-m3-secondary hover:text-m3-text transition-all cursor-pointer shrink-0"
              >
                <Calendar className="w-4 h-4" />
                <span>{t("common.services")}</span>
              </button>
              {currentService && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                    <Calendar className="w-4 h-4" />
                    <span>{currentService.name}.service</span>
                  </div>
                  <div
                    className="ml-auto mr-2 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full
                          px-3 py-1.5 text-xs font-semibold
                          bg-m3-primary-light text-m3-primary
                          border border-m3-primary"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(currentService.date).toLocaleDateString(
                        locale,
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {view === "settings" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Settings className="w-4 h-4" />
                <span>{t("common.settings")}</span>
              </div>
            </>
          )}

          {view === "teams" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Users className="w-4 h-4" />
                <span>{t("common.teams")}</span>
              </div>
            </>
          )}

          {view === "agenda" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Calendar1 className="w-4 h-4" />
                <span>{t("common.agenda")}</span>
              </div>
            </>
          )}

          {view === "trash" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <Trash2Icon className="w-4 h-4" />
                <span>{t("common.trash")}</span>
              </div>
            </>
          )}

          {view === "collections" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className="flex items-center gap-2 font-black text-m3-primary shrink-0 tracking-wide">
                <LibraryBig className="w-4 h-4" />
                <span>{t("common.collections")}</span>
              </div>
            </>
          )}

          {view === "collection-detail" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <button
                onClick={() => navigate(`${slugPrefix}/collections`)}
                className="flex items-center gap-2 font-bold text-m3-secondary hover:text-m3-text transition-all cursor-pointer shrink-0"
              >
                <LibraryBig className="w-4 h-4 opacity-70" />
                <span>{t("common.collections")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search, Notifications & Plus Action */}
      <div className="flex items-center gap-3 w-full md:w-auto overflow-visible hide-scrollbar pb-1 md:pb-0 justify-end">
        {/* Search Input */}
        {(view === "explorer" ||
          view === "songs" ||
          view === "services" ||
          view === "collections" ||
          view === "collection-detail") && (
          <div className="relative w-full sm:w-64 min-w-0">
            <Input
              placeholder={
                view === "services"
                  ? t("addressBar.searchServices")
                  : view === "songs"
                    ? t("addressBar.searchLibrary")
                    : view === "explorer"
                      ? t("addressBar.searchFolders")
                      : t("addressBar.searchCollections")
              }
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onSearchChange("");
                }
              }}
              icon={<Search className="w-4 h-4 text-m3-secondary" />}
              className={`py-2.5 text-sm rounded-2xl ${
                view === "services"
                  ? searchQuery
                    ? "pr-9"
                    : ""
                  : searchQuery
                    ? "pr-16"
                    : "pr-9"
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="p-1 text-m3-secondary hover:text-m3-text hover:bg-m3-hover rounded-lg cursor-pointer transition-all"
                  title={t("addressBar.clearSearch")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {(view === "explorer" || view === "songs") && (
                <button
                  type="button"
                  onClick={() => setIsSearchHelpOpen(true)}
                  className="p-1 text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 rounded-lg cursor-pointer transition-all"
                  title={
                    locale === "pt"
                      ? "Guia de sintaxe de pesquisa (Liqe / Lucene)"
                      : "Search syntax guide (Liqe / Lucene)"
                  }
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {(view === "explorer" || view === "songs") && (
              <SearchSyntaxModal
                isOpen={isSearchHelpOpen}
                onClose={() => setIsSearchHelpOpen(false)}
                onApplyExample={(q) => onSearchChange(q)}
              />
            )}
          </div>
        )}

        <SyncStatusBadge className="shrink-0" showText={false} />

        <InboxButton
          client={authClient as InboxFetchClient}
          className="shrink-0"
        />

        <CanAny
          permissions={[
            "song.create",
            "folder.create",
            "song.import",
            "service.create",
          ]}
        >
          <div className="relative shrink-0 ml-1" ref={plusMenuRef}>
            <button
              onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
              className="w-10 h-10 rounded-2xl bg-m3-primary text-white flex items-center justify-center border border-m3-primary font-black text-lg shadow-xl shadow-m3-primary/20 hover:bg-m3-primary-dark hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={t("addressBar.create")}
            >
              <Plus className="w-5 h-5" />
            </button>
            {isPlusMenuOpen && (
              <div className="absolute right-0 top-full mt-3 w-64 bg-m3-card border border-m3-border rounded-3xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-m3-secondary opacity-60">
                  {t("addressBar.createNew")}
                </div>
                <Can permission="song.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-song");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Music className="w-4 h-4" />
                    </div>
                    {t("addressBar.newSong")}
                  </button>
                </Can>
                <Can permission="song.import">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("cifra-import");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Music2 className="w-4 h-4" />
                    </div>
                    {t("addressBar.importSongs")}
                  </button>
                </Can>
                <Can permission="service.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-service");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Calendar className="w-4 h-4" />
                    </div>
                    {t("addressBar.newService")}
                  </button>
                </Can>
                <Can permission="folder.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-folder");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    {t("addressBar.newFolder")}
                  </button>
                </Can>
                {collections_enabled && (
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-collection");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <LibraryBig className="w-4 h-4" />
                    </div>
                    {t("addressBar.newCollection")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    onOpenModal("create-event");
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold text-m3-text hover:bg-m3-hover rounded-2xl transition-all cursor-pointer text-left group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-m3-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <CalendarPlus className="w-4 h-4 text-amber-500" />
                  </div>
                  {t("agenda.newEvent")}
                </button>
              </div>
            )}
          </div>
        </CanAny>
      </div>
    </div>
  );
};
