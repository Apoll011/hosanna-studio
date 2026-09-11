/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Service } from "@/src/types";
import { Archive, ArrowUpDown, Filter, LayoutGrid, List } from "lucide-react";
import React from "react";
import { ViewName } from "../../layouts/view";

interface ExplorerToolbarProps {
  view: ViewName;
  activeFiltersCount: number;
  showArchived: boolean;
  setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
  archivedServices: Service[];
  sortBy: "title" | "artist" | "updatedAt" | "number";
  sortOrder: "asc" | "desc";
  onSortChange: (
    sb: "title" | "artist" | "updatedAt" | "number",
    so: "asc" | "desc",
  ) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  density: "comfortable" | "compact";
  onDensityChange: (d: "comfortable" | "compact") => void;
  onOpenFilterPanel: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  view,
  activeFiltersCount,
  showArchived,
  setShowArchived,
  archivedServices,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  density,
  onDensityChange,
  onOpenFilterPanel,
}) => {
  const { t } = useI18n();
  if (
    view !== "explorer" &&
    view !== "services" &&
    view !== "songs" &&
    view !== "collections"
  )
    return null;

  return (
    <div className="px-4 py-2.5 bg-m3-sidebar/20 border-b border-m3-border/40 flex items-center justify-between gap-3 flex-wrap">
      {/* Left Side: Filter button, Archive button (services), Sort dropdown */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Filter Pop-Up Panel Trigger Button */}
        {view === "explorer" && (
          <button
            onClick={onOpenFilterPanel}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all cursor-pointer relative ${
              activeFiltersCount > 0
                ? "bg-m3-primary/10 border-m3-primary text-m3-primary shadow-lg shadow-m3-primary/10"
                : "bg-m3-card border-m3-border text-m3-secondary hover:bg-m3-hover hover:text-m3-text hover:border-m3-primary/30"
            }`}
            title={t("toolbar.openFilters")}
          >
            <Filter className="w-4 h-4" />
            <span>{t("toolbar.filters")}</span>
            {activeFiltersCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-m3-primary text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}

        {/* Archive Toggle Button (Services View) */}
        {view === "services" && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all cursor-pointer shrink-0 ${
              showArchived
                ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10"
                : "bg-m3-card border-m3-border text-m3-secondary hover:bg-m3-hover hover:text-m3-text hover:border-amber-500/30"
            }`}
            title={
              showArchived
                ? t("toolbar.hideArchived")
                : t("toolbar.showArchived")
            }
          >
            <Archive className="w-4 h-4" />
            <span>{t("toolbar.archived")}</span>
            {showArchived && archivedServices.length > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {archivedServices.length}
              </span>
            )}
          </button>
        )}

        {/* Sort Control Button */}
        <div className="flex items-center gap-2 bg-m3-bg border border-m3-border rounded-2xl px-3 py-1.5 text-xs transition-all hover:border-m3-primary/30">
          <ArrowUpDown className="w-4 h-4 text-m3-secondary shrink-0" />
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split("-") as [
                "title" | "artist" | "updatedAt" | "number",
                "asc" | "desc",
              ];
              onSortChange(sb, so);
            }}
            className="bg-transparent font-bold text-m3-text focus:outline-none cursor-pointer text-[11px] uppercase tracking-wider"
            title={
              view === "services"
                ? t("toolbar.sortServices")
                : t("toolbar.sortFiles")
            }
          >
            {view === "services" ? (
              <>
                <option
                  value={`${sortBy !== "title" ? sortBy : "updatedAt"}-desc`}
                >
                  {t("toolbar.dateDesc")}
                </option>
                <option
                  value={`${sortBy !== "title" ? sortBy : "updatedAt"}-asc`}
                >
                  {t("toolbar.dateAsc")}
                </option>
                <option value="title-asc">{t("toolbar.nameAsc")}</option>
                <option value="title-desc">{t("toolbar.nameDesc")}</option>
              </>
            ) : view === "collections" ? (
              <>
                <option value="number-asc">{t("toolbar.songNumberAsc")}</option>
                <option value="number-desc">
                  {t("toolbar.songNumberDesc")}
                </option>
                <option value="title-asc">{t("toolbar.nameAsc")}</option>
                <option value="title-desc">{t("toolbar.nameDesc")}</option>
                <option value="updatedAt-asc">{t("toolbar.dateAsc")}</option>
                <option value="updatedAt-desc">{t("toolbar.dateDesc")}</option>
              </>
            ) : (
              <>
                <option value="number-asc">{t("toolbar.numberAsc")}</option>
                <option value="number-desc">{t("toolbar.numberDesc")}</option>
                <option value="title-asc">{t("toolbar.nameAsc")}</option>
                <option value="title-desc">{t("toolbar.nameDesc")}</option>
                <option value="artist-asc">{t("toolbar.artistAsc")}</option>
                <option value="artist-desc">{t("toolbar.artistDesc")}</option>
                <option value="updatedAt-asc">{t("toolbar.dateAsc")}</option>
                <option value="updatedAt-desc">{t("toolbar.dateDesc")}</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Right Side: View Mode Toggle & Density Selector */}
      <div className="flex items-center gap-2.5">
        {/* View Mode Toggle (hidden in Songs view) */}
        {view !== "songs" && view !== "collections" && (
          <div
            role="group"
            aria-label={t("toolbar.viewMode")}
            className="inline-flex items-center bg-slate-100 p-px dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 select-none shrink-0 shadow-inner"
          >
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              title={t("toolbar.gridView")}
              aria-pressed={viewMode === "grid"}
              className={`relative flex items-center justify-center p-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-m3-primary ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-900 text-m3-primary shadow-xs ring-1 ring-black/5 dark:ring-white/10 font-bold scale-[1.02]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="w-4 h-4 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              title={t("toolbar.listView")}
              aria-pressed={viewMode === "list"}
              className={`relative flex items-center justify-center p-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-m3-primary ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-m3-primary shadow-xs ring-1 ring-black/5 dark:ring-white/10 font-bold scale-[1.02]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <List className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        )}
        {/* Density Selector (Confortável / Compacto) */}
        <div className="flex items-center gap-2 bg-m3-bg border border-m3-border rounded-2xl px-3 py-1.5 text-xs transition-all hover:border-m3-primary/30">
          <LayoutGrid className="w-4 h-4 text-m3-primary shrink-0" />
          <select
            value={density}
            onChange={(e) =>
              onDensityChange(e.target.value as "comfortable" | "compact")
            }
            className="bg-transparent font-bold text-m3-text focus:outline-none cursor-pointer text-[11px] uppercase tracking-wider"
            title={t("toolbar.density")}
          >
            <option value="comfortable">{t("toolbar.comfortable")}</option>
            <option value="compact">{t("toolbar.compact")}</option>
          </select>
        </div>
      </div>
    </div>
  );
};
