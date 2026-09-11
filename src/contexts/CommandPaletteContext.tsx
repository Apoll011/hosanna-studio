import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CommandAction } from "../command-palette.types";

interface CommandPaletteContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeParentId: string | null;
  setActiveParentId: (id: string | null) => void;
  registerDynamicActions: (id: string, actions: CommandAction[]) => void;
  unregisterDynamicActions: (id: string) => void;
  recordRecentAction: (id: string) => void;
  recentActionIds: string[];
  allActions: CommandAction[];
}

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(
  null,
);

const RECENTS_KEY = "hosanna_cmd_recent_ids";

export function CommandPaletteProvider({
  children,
  staticActions = [],
}: {
  children: React.ReactNode;
  staticActions?: CommandAction[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [dynamicActionGroups, setDynamicActionGroups] = useState<
    Record<string, CommandAction[]>
  >({});
  const [recentActionIds, setRecentActionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const openPalette = useCallback(() => {
    setIsOpen(true);
    setSearchQuery("");
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveParentId(null);
  }, []);

  const togglePalette = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setSearchQuery("");
        setActiveParentId(null);
        return false;
      }
      return true;
    });
  }, []);

  const registerDynamicActions = useCallback(
    (key: string, actions: CommandAction[]) => {
      setDynamicActionGroups((prev) => ({ ...prev, [key]: actions }));
    },
    [],
  );

  const unregisterDynamicActions = useCallback((key: string) => {
    setDynamicActionGroups((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const recordRecentAction = useCallback((id: string) => {
    setRecentActionIds((prev) => {
      const filtered = prev.filter((item) => item !== id);
      const next = [id, ...filtered].slice(0, 5); // Keep top 5
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  // Keyboard shortcut listener (supports single key and sequence shortcuts like 'g' then 'd')
  const keySequenceRef = useRef<{
    keys: string[];
    timer: NodeJS.Timeout | null;
  }>({
    keys: [],
    timer: null,
  });

  const allActions = useMemo(() => {
    const dynamic = Object.values(dynamicActionGroups).flat();
    return [...staticActions, ...dynamic];
  }, [staticActions, dynamicActionGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Palette with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }

      // If typing in an input/textarea outside the palette, do not trigger shortcuts
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true";

      if (isInput && !isOpen) return;

      if (!isOpen) {
        // Multi-key Sequence Listener (e.g. g -> d, c -> s)
        const key = e.key.toLowerCase();
        const seq = keySequenceRef.current;

        if (seq.timer) clearTimeout(seq.timer);
        seq.keys.push(key);

        seq.timer = setTimeout(() => {
          seq.keys = [];
        }, 600); // 600ms window between keys

        // Check if current key sequence matches an action shortcut
        const currentSeqStr = seq.keys.join("");
        const matchedAction = allActions.find((action) => {
          if (!action.shortcut || action.shortcut.length === 0) return false;
          return action.shortcut.join("").toLowerCase() === currentSeqStr;
        });

        if (matchedAction && matchedAction.perform) {
          e.preventDefault();
          seq.keys = [];
          matchedAction.perform();
          recordRecentAction(matchedAction.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, togglePalette, allActions, recordRecentAction]);

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        setIsOpen,
        openPalette,
        closePalette,
        togglePalette,
        searchQuery,
        setSearchQuery,
        activeParentId,
        setActiveParentId,
        registerDynamicActions,
        unregisterDynamicActions,
        recordRecentAction,
        recentActionIds,
        allActions,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return context;
}
