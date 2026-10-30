/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Button, Input } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Folder, Service, Song } from "@/src/types";
import {
  BarChart3,
  Building2,
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
import React, { useEffect, useRef, useState } from "react";
import { ViewName } from "../../layouts/view";
import { authClient } from "../../lib/authClient";
import { Can, CanAny } from "../../lib/permissions/components";
import { emitOnboardingEvent } from "../../lib/tour";
import { AiChatToggle } from "@/src/features/ai-chat";
import { InboxButton, InboxFetchClient } from "../Inbox";
import { SearchSyntaxModal } from "../modals/SearchSyntaxModal";
import { SyncStatusBadge } from "../SyncStatusBadge";
import { ActiveModal } from "./ExplorerModals";

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
  currentCollectionName?: string;
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
  currentCollectionName,
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

  const crumbCurrent =
    "flex items-center gap-2 font-semibold text-m3-primary shrink-0";
  const crumbLink =
    "flex items-center gap-2 font-medium text-m3-secondary hover:text-m3-text transition-colors cursor-pointer shrink-0";

  return (
    <div className="relative p-3 sm:p-4 bg-m3-sidebar/40 border-b border-m3-border/50 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
      {/* Navigation Controls & Address Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full md:w-auto">
        {/* Mobile Sidebar Toggle */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden shrink-0 text-m3-primary border-m3-primary/30"
          aria-label={t("sidebar.expand")}
        >
          <Menu className="w-4.5 h-4.5" />
        </Button>

        {/* Up / Back Button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
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
          aria-label={
            view === "explorer"
              ? currentFolderId === null
                ? t("addressBar.atRootLevel")
                : currentFolder?.parentId
                  ? t("addressBar.upOneLevel")
                  : t("addressBar.upToRoot")
              : t("addressBar.back")
          }
          className={`shrink-0 ${
            isDriveRoot
              ? "text-m3-secondary/30"
              : "text-m3-primary border-m3-primary/30"
          }`}
        >
          <CornerLeftUp className="w-4.5 h-4.5" />
        </Button>

        {/* Address Path Bar */}
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 min-h-10 bg-m3-bg border border-m3-border rounded-md text-[13px] overflow-x-auto select-none hide-scrollbar shadow-sm min-w-0">
          <button
            onClick={() => {
              onSelectFolder(null);
            }}
            className={`flex items-center gap-2 font-semibold transition-colors cursor-pointer shrink-0 ${
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
                    <div className={crumbCurrent}>
                      <FolderOpen className="w-4 h-4" />
                      <span>{folder.name}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectFolder(folder.id)}
                      className={crumbLink}
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
              <div className={crumbCurrent}>
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
                    className={crumbLink}
                  >
                    <FolderIcon className="w-4 h-4 opacity-70" />
                    <span>{folder.name}</span>
                  </button>
                </React.Fragment>
              ))}

              {currentSong && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <div className={crumbCurrent}>
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
              <div className={crumbCurrent}>
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
                className={crumbLink}
              >
                <Calendar className="w-4 h-4" />
                <span>{t("common.services")}</span>
              </button>
              {currentService && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <div className={crumbCurrent}>
                    <Calendar className="w-4 h-4" />
                    <span>{currentService.name}.service</span>
                  </div>
                  <div
                    className="ml-auto mr-2 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md
                          px-3 py-0.8 text-xs font-medium
                          bg-m3-primary/10 text-m3-primary
                          border border-m3-primary/20"
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
              <div className={crumbCurrent}>
                <Settings className="w-4 h-4" />
                <span>{t("common.settings")}</span>
              </div>
            </>
          )}

          {view === "organization" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
                <Building2 className="w-4 h-4" />
                <span>{t("common.organization")}</span>
              </div>
            </>
          )}

          {view === "analytics" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
                <BarChart3 className="w-4 h-4" />
                <span>{t("common.analytics")}</span>
              </div>
            </>
          )}

          {view === "teams" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
                <Users className="w-4 h-4" />
                <span>{t("common.teams")}</span>
              </div>
            </>
          )}

          {view === "agenda" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
                <Calendar1 className="w-4 h-4" />
                <span>{t("common.agenda")}</span>
              </div>
            </>
          )}

          {view === "trash" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
                <Trash2Icon className="w-4 h-4" />
                <span>{t("common.trash")}</span>
              </div>
            </>
          )}

          {view === "collections" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
              <div className={crumbCurrent}>
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
                className={crumbLink}
              >
                <LibraryBig className="w-4 h-4 opacity-70" />
                <span>{t("common.collections")}</span>
              </button>
              {currentCollectionName && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-m3-secondary/40 shrink-0" />
                  <div className={crumbCurrent}>
                    <LibraryBig className="w-4 h-4" />
                    <span>{currentCollectionName}</span>
                  </div>
                </>
              )}
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
          <div
            data-tour="toolbar-search"
            className="relative w-full sm:w-64 min-w-0"
          >
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
              className={`py-2.5 text-sm rounded-md ${
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
                  className="p-1.5 min-h-8 min-w-8 text-m3-secondary hover:text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] cursor-pointer transition-colors"
                  title={t("addressBar.clearSearch")}
                  aria-label={t("addressBar.clearSearch")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {(view === "explorer" || view === "songs") && (
                <button
                  type="button"
                  onClick={() => setIsSearchHelpOpen(true)}
                  className="p-1.5 min-h-8 min-w-8 text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 rounded-[var(--radius-md)] cursor-pointer transition-colors"
                  title={
                    locale === "pt"
                      ? "Guia de sintaxe de pesquisa (Liqe / Lucene)"
                      : "Search syntax guide (Liqe / Lucene)"
                  }
                  aria-label={
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

        <AiChatToggle />

        <CanAny
          permissions={[
            "song.create",
            "folder.create",
            "song.import",
            "service.create",
            "collection.create",
            "agenda.create",
          ]}
        >
          <div className="relative shrink-0 ml-1" ref={plusMenuRef}>
            <Button
              type="button"
              data-tour="toolbar-create"
              variant="primary"
              size="icon"
              onClick={() => {
                const next = !isPlusMenuOpen;
                setIsPlusMenuOpen(next);
                if (next) emitOnboardingEvent("create-menu-opened");
              }}
              title={t("addressBar.create")}
              aria-label={t("addressBar.create")}
            >
              <Plus className="w-5 h-5" />
            </Button>
            {isPlusMenuOpen && (
              <div
                data-tour="create-menu"
                className="absolute right-0 top-full mt-3 w-64 bg-m3-card border border-m3-border rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="px-4 py-2 text-label">
                  {t("addressBar.createNew")}
                </div>
                <Can permission="song.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-song");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
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
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
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
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
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
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    {t("addressBar.newFolder")}
                  </button>
                </Can>
                <Can permission="collection.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-collection");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                      <LibraryBig className="w-4 h-4" />
                    </div>
                    {t("addressBar.newCollection")}
                  </button>
                </Can>
                <Can permission="agenda.create">
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenModal("create-event");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-10 text-xs font-medium text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                      <CalendarPlus className="w-4 h-4" />
                    </div>
                    {t("agenda.newEvent")}
                  </button>
                </Can>
              </div>
            )}
          </div>
        </CanAny>
      </div>
    </div>
  );
};
