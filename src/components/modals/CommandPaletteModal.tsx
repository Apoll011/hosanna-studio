import { CommandAction } from "@/src/command-palette.types";
import { useCommandPalette } from "@/src/contexts/CommandPaletteContext";
import { useI18n } from "@/src/lib/i18n";
import {
  ChevronRight,
  Command,
  CornerDownLeft,
  History,
  Loader2,
  Search,
  SearchX,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

// Substring Highlighter
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span
            key={i}
            className="text-m3-primary font-semibold underline underline-offset-2"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

interface CommandPaletteModalProps {
  staticActions: CommandAction[];
  isSearchingDb?: boolean;
}

export function CommandPaletteModal({
  staticActions,
  isSearchingDb,
}: CommandPaletteModalProps) {
  const {
    isOpen,
    closePalette,
    searchQuery,
    setSearchQuery,
    activeParentId,
    setActiveParentId,
    recordRecentAction,
    recentActionIds,
    allActions,
  } = useCommandPalette();

  const { t } = useI18n();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
      setSelectedIndex(0);
    }
  }, [isOpen, activeParentId]);

  // Filter actions based on search and parent context
  const filteredActions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Context filter (Nested submenus)
    let currentPool = allActions.filter((a) => {
      if (activeParentId) return a.parent === activeParentId;
      return !a.parent; // Top level
    });

    if (!q) {
      // Empty search state: Group pinned Recents (if any) at top
      if (!activeParentId && recentActionIds.length > 0) {
        const recents: CommandAction[] = [];
        recentActionIds.forEach((id) => {
          const found = currentPool.find((a) => a.id === id);
          if (found) {
            recents.push({
              ...found,
              id: `recent-${found.id}`,
              section: t("palette.recents"),
              icon: <History className="w-4 h-4 text-(--m3-secondary)" />,
              perform: found.perform,
            });
          }
        });
        const nonRecents = currentPool.filter(
          (a) => !recentActionIds.includes(a.id),
        );
        return [...recents, ...nonRecents];
      }
      return currentPool;
    }

    // Match query against Name, Keywords, Subtitle, and Section
    return currentPool.filter((action) => {
      const matchName = action.name.toLowerCase().includes(q);
      const matchKeywords = action.keywords?.toLowerCase().includes(q);
      const matchSub = action.subtitle?.toLowerCase().includes(q);
      const matchSec = action.section?.toLowerCase().includes(q);
      return matchName || matchKeywords || matchSub || matchSec;
    });
  }, [allActions, searchQuery, activeParentId, recentActionIds, t]);

  // Group actions by Section
  const groupedActions = useMemo(() => {
    const groups: { section: string; actions: CommandAction[] }[] = [];
    filteredActions.forEach((action) => {
      const sec = action.section || t("palette.defaultSection");
      let g = groups.find((item) => item.section === sec);
      if (!g) {
        g = { section: sec, actions: [] };
        groups.push(g);
      }
      g.actions.push(action);
    });
    return groups;
  }, [filteredActions, t]);

  // Flat list of visible actions to map keyboard navigation indices
  const flatVisibleActions = useMemo(() => {
    return groupedActions.flatMap((g) => g.actions);
  }, [groupedActions]);

  // Ensure index stays in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, activeParentId]);

  // Keep selected element visible inside the scroll container
  useEffect(() => {
    if (!listContainerRef.current) return;
    const selectedEl = listContainerRef.current.querySelector(
      `[data-action-index="${selectedIndex}"]`,
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle action execution
  const executeAction = (action: CommandAction) => {
    recordRecentAction(action.id.replace("recent-", ""));
    if (action.perform) {
      action.perform();
      closePalette();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (activeParentId) {
        setActiveParentId(null);
      } else {
        closePalette();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flatVisibleActions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : flatVisibleActions.length - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = flatVisibleActions[selectedIndex];
      if (current) executeAction(current);
    } else if (e.key === "Backspace" && searchQuery === "" && activeParentId) {
      e.preventDefault();
      setActiveParentId(null);
    }
  };

  if (!isOpen) return null;

  let globalIndexCounter = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[12vh] px-4 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-m3-card border border-m3-border shadow-2xl overflow-hidden flex flex-col transition-all duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-m3-border">
          <Search className="w-5 h-5 text-m3-primary mr-3 shrink-0" />

          {activeParentId && (
            <div className="flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-lg bg-m3-primary-light/60 dark:bg-m3-primary-dark text-xs font-semibold text-m3-primary">
              <span>{t("palette.submenu")}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeParentId
                ? t("palette.searchSubmenu")
                : t("palette.searchPlaceholder")
            }
            className="w-full bg-transparent text-m3-text placeholder-m3-input text-sm outline-none font-sans"
          />

          {isSearchingDb ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-m3-hover text-[10px] text-m3-secondary">
              <Loader2 className="w-3 h-3 animate-spin text-m3-primary" />
              <span>RxDB</span>
            </div>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-m3-sidebar border border-m3-border text-m3-secondary">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listContainerRef} className="max-h-95 overflow-y-auto py-2">
          {flatVisibleActions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-m3-hover flex items-center justify-center mb-3">
                <SearchX className="w-6 h-6 text-m3-secondary" />
              </div>
              <p className="text-sm font-medium text-m3-text">
                {t("palette.noResults")}
              </p>
              <p className="text-xs text-m3-secondary mt-1 max-w-70">
                {t("palette.noResultsDesc", { query: searchQuery })}
              </p>
            </div>
          ) : (
            groupedActions.map((group) => (
              <div key={group.section} className="mb-2 last:mb-0">
                <div className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-m3-secondary opacity-80 select-none">
                  {group.section}
                </div>

                {group.actions.map((action) => {
                  const currentIndex = globalIndexCounter++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <div
                      key={action.id}
                      data-action-index={currentIndex}
                      onClick={() => executeAction(action)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`mx-2 my-0.5 flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-100 select-none ${
                        isSelected
                          ? "bg-m3-primary-light/50 dark:bg-m3-primary-dark/50 text-m3-text"
                          : "text-m3-text/90 hover:bg-m3-hover"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {action.isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-m3-primary" />
                        ) : action.icon ? (
                          <div className="shrink-0 flex items-center justify-center">
                            {action.icon}
                          </div>
                        ) : null}

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate font-sans">
                              <HighlightText
                                text={action.name}
                                query={searchQuery}
                              />
                            </span>
                            {action.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-m3-hover border border-m3-border text-m3-secondary font-mono">
                                {action.badge}
                              </span>
                            )}
                          </div>
                          {action.subtitle && (
                            <span className="text-xs text-m3-secondary truncate">
                              <HighlightText
                                text={action.subtitle}
                                query={searchQuery}
                              />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {action.shortcut?.length ? (
                          <div className="flex gap-1 items-center">
                            {action.shortcut.map((key) => (
                              <kbd
                                key={key}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded uppercase bg-m3-sidebar border border-m3-border text-m3-secondary shadow-xs"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        ) : isSelected ? (
                          <CornerDownLeft className="w-3.5 h-3.5 text-m3-primary opacity-80" />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-m3-toolbar border-t border-m3-border flex items-center justify-between text-[11px] text-m3-secondary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-m3-card border border-m3-border">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 rounded bg-m3-card border border-m3-border">
                ↓
              </kbd>{" "}
              {t("palette.navigate")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-m3-card border border-m3-border">
                ↵
              </kbd>{" "}
              {t("palette.select")}
            </span>
          </div>
          <span className="flex items-center gap-1 font-medium text-m3-primary">
            <Command className="w-3 h-3 text-m3-primary" /> {t("palette.title")}
          </span>
        </div>
      </div>
    </div>
  );
}
