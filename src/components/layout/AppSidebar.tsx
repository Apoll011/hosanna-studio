/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { posthog } from "@/src/lib/posthog";
import { Folder } from "@/src/types";
import { Organization } from "better-auth/client";
import {
  Calendar1,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Church,
  HardDrive,
  LibraryBig,
  LogOut,
  Music,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { Organization as AuthOrganization } from "../../contexts/AuthContext";
import { ViewName } from "../../layouts/view";
import { getAvatarGradient, getInitials } from "../../utils";
import { FolderTreeItemNode, FolderTreeNode } from "../explorer";
import { getRoleLabel } from "../settings/settingsUtils";

interface AppSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  organization?: Organization | null;
  /** Organizations the user belongs to; enables the workspace switcher when > 1. */
  organizations?: AuthOrganization[];
  onSwitchOrganization?: (org: AuthOrganization) => void;
  slugPrefix: string;
  view: ViewName;
  currentFolderId: string | null;
  rootSongsCount: number;
  rootFoldersCount: number;
  totalSongs: number;
  totalServices: number;
  totalCollections: number;
  trashCount: number;
  eventCount: number;
  allFolders: Folder[];
  folderTree: FolderTreeNode[];
  expandedFolderIds: Set<string>;
  showFolderTree: boolean;
  user?: {
    name: string;
    image?: unknown;
    role?: string;
  } | null;
  onSelectFolder: (id: string | null) => void;
  onContextMenu: (
    e: React.MouseEvent,
    type: "folder" | "song",
    item: Folder,
  ) => void;
  toggleExpand: (id: string) => void;
  navigate: (path: string) => void;
  logout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  organization,
  organizations,
  onSwitchOrganization,
  slugPrefix,
  view,
  currentFolderId,
  rootSongsCount,
  rootFoldersCount,
  totalSongs,
  totalServices,
  totalCollections,
  trashCount,
  eventCount,
  allFolders,
  folderTree,
  expandedFolderIds,
  showFolderTree,
  user,
  onSelectFolder,
  onContextMenu,
  toggleExpand,
  navigate,
  logout,
}) => {
  const { t } = useI18n();
  const shortName = organization?.metadata?.shortName || "";
  const isDriveRoot = view === "explorer" && currentFolderId === null;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const hasMultipleOrgs = (organizations?.length ?? 0) > 1;

  const teams_enabled = posthog.isFeatureEnabled("teams-enable") || false;
  const agenda_enabled = posthog.isFeatureEnabled("agenda") || true;
  const collections_enabled = posthog.isFeatureEnabled("collection") || false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        orgMenuRef.current &&
        !orgMenuRef.current.contains(event.target as Node)
      ) {
        setIsOrgMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`${
          isSidebarOpen
            ? "flex absolute inset-y-0 left-0 z-50 bg-m3-sidebar shadow-2xl"
            : "hidden"
        } md:flex md:relative md:bg-m3-sidebar/30 ${
          isSidebarCollapsed ? "md:w-20" : "md:w-64"
        } w-72 border-r border-m3-border p-4 flex-col gap-1 select-none shrink-0 transition-all duration-300 ease-in-out z-30`}
        role="navigation"
      >
        {/* Integrated Sidebar Header */}
        <div
          className="relative flex items-center mb-4 mt-2 select-none"
          role="banner"
          ref={orgMenuRef}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Logo container: expands on click when collapsed, hover swaps icon */}
            <button
              onClick={() => isSidebarCollapsed && setIsSidebarCollapsed(false)}
              disabled={!isSidebarCollapsed}
              title={isSidebarCollapsed ? t("sidebar.expand") : undefined}
              className={`w-11 h-11 rounded-xl flex items-center justify-center border border-m3-border/50 bg-m3-card text-m3-secondary shadow-xs shrink-0 relative group transition-all duration-300 ${
                isSidebarCollapsed
                  ? "cursor-pointer hover:bg-m3-hover hover:border-m3-border hover:text-m3-text"
                  : ""
              }`}
            >
              <img
                src="/favicon.png"
                alt="Hosanna Studio"
                className={`w-10 h-10 object-contain rounded-lg transition-all duration-200 ${
                  isSidebarCollapsed
                    ? "group-hover:opacity-0"
                    : "hover:scale-105"
                }`}
              />
              <ChevronRight
                className={`w-5 h-5 absolute inset-0 m-auto transition-opacity duration-200 pointer-events-none ${
                  isSidebarCollapsed
                    ? "opacity-0 group-hover:opacity-100"
                    : "opacity-0 hidden"
                }`}
              />
            </button>

            {/* Title & Subtitle + Collapse button with smooth transition */}
            <div
              className={`flex flex-col items-start min-w-0 flex-1 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                  : "opacity-100 max-w-50 translate-x-0"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <h1 className="font-display font-black text-xl tracking-tighter text-slate-900 dark:text-slate-100 leading-none truncate">
                  Hosanna Studio
                </h1>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="hidden md:flex p-1.5 rounded-xl hover:bg-m3-hover text-m3-secondary hover:text-m3-text border border-transparent hover:border-m3-border/60 transition-all cursor-pointer shrink-0 -mr-2"
                  title={t("sidebar.collapse")}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              {organization &&
                (hasMultipleOrgs ? (
                  <button
                    onClick={() => setIsOrgMenuOpen((v) => !v)}
                    title={t("sidebar.switchWorkspace")}
                    aria-haspopup="menu"
                    aria-expanded={isOrgMenuOpen}
                    className="mt-1 inline-flex max-w-full min-w-0 items-center gap-1 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-m3-primary/40"
                  >
                    <span className="truncate min-w-0">
                      {organization?.metadata?.shortName || organization.slug}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                        isOrgMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span className="mt-1 block max-w-32.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {organization?.metadata?.shortName || organization.slug}
                  </span>
                ))}
            </div>
          </div>

          {/* Workspace Switcher Popover */}
          {hasMultipleOrgs && isOrgMenuOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
              role="menu"
            >
              <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                {t("sidebar.switchWorkspace")}
              </p>
              {organizations?.map((o) => {
                const isActive = o.id === organization?.id;
                return (
                  <button
                    key={o.id}
                    role="menuitem"
                    disabled={isActive}
                    onClick={() => {
                      setIsOrgMenuOpen(false);
                      if (onSwitchOrganization) {
                        void onSwitchOrganization(o);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                      isActive
                        ? "bg-m3-primary/10 text-m3-primary cursor-default"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-m3-primary/10 border border-m3-border/60 text-[11px] font-black text-m3-primary">
                      {o.logo ? (
                        <img
                          src={o.logo}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (o.name?.trim().charAt(0) || "·").toUpperCase()
                      )}
                    </div>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold truncate">
                        {o.name}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        @{o.slug}
                      </span>
                    </span>
                    {isActive && (
                      <Check className="w-4 h-4 shrink-0 text-m3-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Menu Label */}
        <div
          className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-m3-secondary transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
            isSidebarCollapsed
              ? "opacity-0 max-h-0 py-0 -translate-x-2 pointer-events-none"
              : "opacity-60 max-h-8 translate-x-0"
          }`}
        >
          {t("sidebar.mainMenu")}
        </div>

        {/* Drive Item */}
        <button
          onClick={() => {
            onSelectFolder(null);
            navigate(`${slugPrefix}/folders`);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          title={
            isSidebarCollapsed
              ? t("sidebar.drive", { name: shortName })
              : undefined
          }
          className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
            isDriveRoot
              ? "bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shadow-sm"
              : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <HardDrive
                className={`w-4.5 h-4.5 ${
                  isDriveRoot ? "text-m3-primary" : "text-m3-secondary"
                }`}
              />
            </div>
            <span
              className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                  : "opacity-100 max-w-35 translate-x-0"
              }`}
            >
              {t("sidebar.drive", { name: shortName })}
            </span>
          </div>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
              isSidebarCollapsed
                ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                : "opacity-100 max-w-15 scale-100"
            }`}
          >
            <Badge variant={isDriveRoot ? "sky" : "slate"}>
              {rootSongsCount + rootFoldersCount}
            </Badge>
          </div>
        </button>

        {/* Library Item */}
        <button
          onClick={() => {
            navigate(`${slugPrefix}/songs`);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          title={isSidebarCollapsed ? t("common.library") : undefined}
          className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
            view === "songs"
              ? "bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shadow-sm"
              : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Music
                className={`w-4.5 h-4.5 ${
                  view === "songs" ? "text-m3-primary" : "text-m3-secondary"
                }`}
              />
            </div>
            <span
              className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                  : "opacity-100 max-w-35 translate-x-0"
              }`}
            >
              {t("common.library")}
            </span>
          </div>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
              isSidebarCollapsed
                ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                : "opacity-100 max-w-15 scale-100"
            }`}
          >
            <Badge variant={view === "songs" ? "sky" : "slate"}>
              {totalSongs}
            </Badge>
          </div>
        </button>

        {/* Services Item */}
        <button
          onClick={() => {
            navigate(`${slugPrefix}/services`);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          title={isSidebarCollapsed ? t("common.services") : undefined}
          className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
            view === "services"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm"
              : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Church
                className={`w-4.5 h-4.5 ${
                  view === "services" ? "text-emerald-500" : "text-m3-secondary"
                }`}
              />
            </div>
            <span
              className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                  : "opacity-100 max-w-35 translate-x-0"
              }`}
            >
              {t("common.services")}
            </span>
          </div>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
              isSidebarCollapsed
                ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                : "opacity-100 max-w-15 scale-100"
            }`}
          >
            <Badge variant={view === "services" ? "sky" : "slate"}>
              {totalServices}
            </Badge>
          </div>
        </button>

        {collections_enabled && (
          <button
            onClick={() => {
              navigate(`${slugPrefix}/collections`);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            title={isSidebarCollapsed ? "Coleções" : undefined}
            className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
              view === "collections" || view === "collection-detail"
                ? "bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shadow-sm"
                : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <LibraryBig
                  className={`w-4.5 h-4.5 ${
                    view === "collections" || view === "collection-detail"
                      ? "text-m3-primary"
                      : "text-m3-secondary"
                  }`}
                />
              </div>
              <span
                className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                  isSidebarCollapsed
                    ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                    : "opacity-100 max-w-35 translate-x-0"
                }`}
              >
                {t("common.collections")}
              </span>
            </div>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                  : "opacity-100 max-w-15 scale-100"
              }`}
            >
              <Badge
                variant={
                  view === "collections" || view === "collection-detail"
                    ? "sky"
                    : "slate"
                }
              >
                {totalCollections}
              </Badge>
            </div>
          </button>
        )}
        {/* Collections Item */}

        {teams_enabled && (
          <button
            onClick={() => {
              navigate(`${slugPrefix}/teams`);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            title={isSidebarCollapsed ? t("common.teams") : undefined}
            className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
              view === "teams"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm"
                : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Users
                  className={`w-4.5 h-4.5 ${
                    view === "teams" ? "text-amber-500" : "text-m3-secondary"
                  }`}
                />
              </div>
              <span
                className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                  isSidebarCollapsed
                    ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                    : "opacity-100 max-w-35 translate-x-0"
                }`}
              >
                {t("common.teams")}
              </span>
            </div>
          </button>
        )}

        {agenda_enabled && (
          <button
            onClick={() => {
              navigate(`${slugPrefix}/agenda`);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            title={isSidebarCollapsed ? t("common.agenda") : undefined}
            className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
              view === "agenda"
                ? "bg-amber-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shadow-sm"
                : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Calendar1
                  className={`w-4.5 h-4.5 ${
                    view === "agenda" ? "text-red-500" : "text-m3-secondary"
                  }`}
                />
              </div>
              <span
                className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                  isSidebarCollapsed
                    ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                    : "opacity-100 max-w-35 translate-x-0"
                }`}
              >
                {t("common.agenda")}
              </span>
            </div>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                  : "opacity-100 max-w-15 scale-100"
              }`}
            >
              <Badge variant={view === "services" ? "sky" : "slate"}>
                {eventCount}
              </Badge>
            </div>
          </button>
        )}

        {/* Folder Tree */}
        {showFolderTree && (
          <div
            className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out overflow-hidden ${
              isSidebarCollapsed
                ? "opacity-0 max-h-0 pointer-events-none"
                : "opacity-100 max-h-full"
            }`}
          >
            <div className="mt-6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-m3-secondary opacity-60 shrink-0 whitespace-nowrap">
              {t("sidebar.foldersCount", { count: allFolders.length })}
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
              {folderTree.map((node) => (
                <FolderTreeItemNode
                  key={node.folder.id}
                  node={node}
                  currentFolderId={currentFolderId}
                  onSelectFolder={(id) => {
                    onSelectFolder(id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  onContextMenu={onContextMenu}
                  expandedFolderIds={expandedFolderIds}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          </div>
        )}

        {(!showFolderTree || isSidebarCollapsed) && <div className="flex-1" />}

        {/* Trash Item */}
        <button
          onClick={() => {
            navigate(`${slugPrefix}/trash`);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          title={isSidebarCollapsed ? t("sidebar.trash") : undefined}
          className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-bold rounded-2xl transition-all cursor-pointer group ${
            view === "trash"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm"
              : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Trash2
                className={`w-4.5 h-4.5 ${
                  view === "trash" ? "text-rose-500" : "text-m3-secondary"
                }`}
              />
            </div>
            <span
              className={`truncate transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed
                  ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                  : "opacity-100 max-w-35 translate-x-0"
              }`}
            >
              {t("sidebar.trash")}
            </span>
          </div>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
              isSidebarCollapsed
                ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                : "opacity-100 max-w-15 scale-100"
            }`}
          >
            <Badge variant={view === "trash" ? "rose" : "slate"}>
              {trashCount}
            </Badge>
          </div>
        </button>

        {/* User profile footer with smooth transitions */}
        {user && (
          <div
            className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 relative shrink-0"
            ref={userMenuRef}
          >
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              title={isSidebarCollapsed ? user.name : undefined}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-full bg-linear-to-tr ${getAvatarGradient(
                    user.name,
                  )} flex items-center justify-center text-white font-extrabold text-xs shadow-sm shrink-0`}
                >
                  {user.image ? (
                    <img
                      src={user.image as string}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <div
                  className={`flex flex-col min-w-0 text-left transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                    isSidebarCollapsed
                      ? "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
                      : "opacity-100 max-w-35 translate-x-0"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {user.name}
                  </span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider truncate">
                    {getRoleLabel(user.role ?? "guest")}
                  </span>
                </div>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
                  isSidebarCollapsed
                    ? "opacity-0 max-w-0 scale-75 pointer-events-none"
                    : "opacity-100 max-w-6 scale-100"
                }`}
              >
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate(`${slugPrefix}/settings`);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Settings className="w-4 h-4 text-sky-600" />
                  {t("sidebar.openSettings")}
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  {t("sidebar.logout")}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
