import { useI18n } from "@/src/lib/i18n";
import { Folder, Service, Song } from "@/src/types";
import {
  Calendar,
  CalendarPlus,
  ChevronRight,
  Church,
  Download,
  Filter,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  LogOut,
  Moon,
  Move,
  Music,
  Plus,
  Printer,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useMemo } from "react";
import { CommandAction } from "../command-palette.types";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "../contexts/CommandPaletteContext";
import { ViewName } from "../layouts/view";
import { useRxDbSearch } from "../hooks/useRxDbSearch";
import { ActiveModal } from "./layout";
import { CommandPaletteModal } from "./modals/CommandPaletteModal";

export interface HosannaCommandPaletteProps {
  children: React.ReactNode;
  slugPrefix: string;
  navigate: (path: string) => void;
  logout: () => void;
  // State from view contexts
  currentFolderId?: string | null;
  currentSong?: Song | null;
  currentService?: Service | null;
  view?: ViewName;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  setCurrentFolderId: (id: string | null) => void;
  openModal: (modal: ActiveModal) => void;
  handleViewModeChange: (mode: "grid" | "list") => void;
  handlePrintSong: (id: string) => void;
  setMoveSongTarget: (song: Song | null) => void;
  setTargetSongFolderId: (folderId: string) => void;
  setDeleteSongTarget: (song: Song | null) => void;
  deleteService: (id: string) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  // RxDB finders
  searchSongsDb: (query: string) => Promise<Song[]>;
  searchFoldersDb: (query: string) => Promise<Folder[]>;
  searchServicesDb: (query: string) => Promise<Service[]>;
  getFolderPathString: (parentId?: string | null) => string;
  isDataLoading?: boolean;
}

function InnerPalette(
  props: HosannaCommandPaletteProps & { staticActions: CommandAction[] },
) {
  const { isSearching } = useRxDbSearch({
    slugPrefix: props.slugPrefix,
    navigate: props.navigate,
    searchSongsDb: props.searchSongsDb,
    isDataLoading: props.isDataLoading,
    searchFoldersDb: props.searchFoldersDb,
    searchServicesDb: props.searchServicesDb,
    getFolderPathString: props.getFolderPathString,
  });

  return (
    <CommandPaletteModal
      staticActions={props.staticActions}
      isSearchingDb={isSearching}
    />
  );
}

export function HosannaCommandPalette(props: HosannaCommandPaletteProps) {
  const {
    slugPrefix,
    navigate,
    logout,
    currentSong,
    currentService,
    view,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setCurrentFolderId,
    openModal,
    handleViewModeChange,
    handlePrintSong,
    setMoveSongTarget,
    setTargetSongFolderId,
    setDeleteSongTarget,
    deleteService,
    fileInputRef,
  } = props;

  const { t } = useI18n();

  const staticActions = useMemo<CommandAction[]>(() => {
    const actions: CommandAction[] = [
      // --- NAVEGAÇÃO ---
      {
        id: "nav-drive",
        name: t("commandPalette.navDrive"),
        shortcut: ["g", "d"],
        keywords: "drive inicio home pastas root folders",
        section: t("commandPalette.sections.navigation"),
        icon: <HardDrive className="w-4 h-4 text-sky-500" />,
        perform: () => {
          setCurrentFolderId(null);
          navigate(`${slugPrefix}/folders`);
        },
      },
      {
        id: "nav-songs",
        name: t("commandPalette.navSongs"),
        shortcut: ["g", "s"],
        keywords: "biblioteca canticos musicas songs library",
        section: t("commandPalette.sections.navigation"),
        icon: <Music className="w-4 h-4 text-sky-500" />,
        perform: () => navigate(`${slugPrefix}/songs`),
      },
      {
        id: "nav-services",
        name: t("commandPalette.navServices"),
        shortcut: ["g", "c"],
        keywords: "cultos planos servicos services worship",
        section: t("commandPalette.sections.navigation"),
        icon: <Church className="w-4 h-4 text-emerald-500" />,
        perform: () => navigate(`${slugPrefix}/services`),
      },
      {
        id: "nav-settings",
        name: t("commandPalette.navSettings"),
        shortcut: ["g", "t"],
        keywords: "definicoes configuracoes settings preferences",
        section: t("commandPalette.sections.navigation"),
        icon: <Settings className="w-4 h-4 text-slate-500" />,
        perform: () => navigate(`${slugPrefix}/settings`),
      },
      {
        id: "nav-agenda",
        name: t("commandPalette.navAgenda"),
        shortcut: ["g", "a"],
        keywords: "agenda calendario eventos calendar events schedule",
        section: t("commandPalette.sections.navigation"),
        icon: <Calendar className="w-4 h-4 text-violet-500" />,
        perform: () => navigate(`${slugPrefix}/agenda`),
      },

      // --- AÇÕES RÁPIDAS ---
      {
        id: "action-create-song",
        name: t("commandPalette.createSong"),
        shortcut: ["c", "s"],
        keywords: "novo cantico musica adicionar song create add",
        section: t("commandPalette.sections.quickActions"),
        icon: <Plus className="w-4 h-4 text-sky-500" />,
        perform: () => openModal("create-song"),
      },
      {
        id: "action-import-cifra",
        name: t("commandPalette.importCifra"),
        shortcut: ["c", "i"],
        keywords: "importar cifraclub cifra web url fetch",
        section: t("commandPalette.sections.quickActions"),
        icon: <Download className="w-4 h-4 text-sky-500" />,
        perform: () => openModal("cifra-import"),
      },
      {
        id: "action-create-service",
        name: t("commandPalette.createService"),
        shortcut: ["c", "c"],
        keywords: "novo culto plano servico create service worship date",
        section: t("commandPalette.sections.quickActions"),
        icon: <Calendar className="w-4 h-4 text-emerald-500" />,
        perform: () => openModal("create-service"),
      },
      {
        id: "action-create-folder",
        name: t("commandPalette.createFolder"),
        shortcut: ["c", "f"],
        keywords: "nova pasta diretorio novapasta create folder directory",
        section: t("commandPalette.sections.quickActions"),
        icon: <FolderPlus className="w-4 h-4 text-amber-500" />,
        perform: () => openModal("create-folder"),
      },
      {
        id: "action-create-agenda",
        name: t("commandPalette.createAgenda"),
        shortcut: ["c", "a"],
        keywords: "novo evento agenda criar event schedule create add",
        section: t("commandPalette.sections.quickActions"),
        icon: <CalendarPlus className="w-4 h-4 text-violet-500" />,
        perform: () => openModal("create-event"),
      },
      {
        id: "action-upload-files",
        name: t("commandPalette.uploadFiles"),
        shortcut: ["u"],
        keywords: "upload carregar ficheiros chordpro sbpbackup import txt pro",
        section: t("commandPalette.sections.quickActions"),
        icon: <Upload className="w-4 h-4 text-purple-500" />,
        perform: () => fileInputRef.current?.click(),
      },

      // --- TEMA E PREFERÊNCIAS ---
      {
        id: "toggle-theme",
        name: t("commandPalette.toggleTheme"),
        shortcut: ["t", "t"],
        keywords: "tema dark light modo escuro claro theme",
        section: t("commandPalette.sections.account"),
        icon: <Moon className="w-4 h-4 text-amber-500" />,
        perform: () => {
          const isDark = document.documentElement.classList.toggle("dark");
          localStorage.setItem("theme", isDark ? "dark" : "light");
        },
      },
      {
        id: "toggle-sidebar",
        name: isSidebarCollapsed
          ? t("commandPalette.toggleSidebarExpand")
          : t("commandPalette.toggleSidebarCollapse"),
        shortcut: ["b", "s"],
        keywords: "sidebar menu barras lateral recolher expandir toggle",
        section: t("commandPalette.sections.account"),
        icon: <ChevronRight className="w-4 h-4 text-slate-500" />,
        perform: () => setIsSidebarCollapsed(!isSidebarCollapsed),
      },
      {
        id: "user-logout",
        name: t("commandPalette.logout"),
        keywords: "sair logout encerrar sessao exit",
        section: t("commandPalette.sections.account"),
        icon: <LogOut className="w-4 h-4 text-rose-500" />,
        perform: () => logout(),
      },
    ];

    if (view === "explorer") {
      actions.push(
        {
          id: "view-grid",
          name: t("commandPalette.viewGrid"),
          keywords: "vista grelha grid view layout",
          section: t("commandPalette.sections.visualization"),
          icon: <LayoutGrid className="w-4 h-4 text-slate-500" />,
          perform: () => handleViewModeChange("grid"),
        },
        {
          id: "view-list",
          name: t("commandPalette.viewList"),
          keywords: "vista lista list view table layout",
          section: t("commandPalette.sections.visualization"),
          icon: <List className="w-4 h-4 text-slate-500" />,
          perform: () => handleViewModeChange("list"),
        },
        {
          id: "open-filters",
          name: t("commandPalette.openFilters"),
          keywords: "filtros filter pesquisar tom tag artista",
          section: t("commandPalette.sections.visualization"),
          icon: <Filter className="w-4 h-4 text-slate-500" />,
          perform: () => openModal("filter"),
        },
      );
    }

    if (view === "song-editor" && currentSong) {
      actions.push(
        {
          id: "song-print-current",
          name: t("commandPalette.printSong", { title: currentSong.title }),
          keywords: "imprimir print pdf cantico atual",
          section: t("commandPalette.sections.currentSong"),
          icon: <Printer className="w-4 h-4 text-indigo-500" />,
          perform: () => handlePrintSong(currentSong.id),
        },
        {
          id: "song-move-current",
          name: t("commandPalette.moveSong", { title: currentSong.title }),
          keywords: "mover pasta move folder destination",
          section: t("commandPalette.sections.currentSong"),
          icon: <Move className="w-4 h-4 text-sky-500" />,
          perform: () => {
            setMoveSongTarget(currentSong);
            if (currentSong.folderId)
              setTargetSongFolderId(currentSong.folderId);
          },
        },
        {
          id: "song-delete-current",
          name: t("commandPalette.deleteSong", { title: currentSong.title }),
          keywords: "eliminar apagar remover delete remove",
          section: t("commandPalette.sections.currentSong"),
          icon: <Trash2 className="w-4 h-4 text-rose-500" />,
          perform: () => setDeleteSongTarget(currentSong),
        },
      );
    }

    if (view === "service-editor" && currentService) {
      actions.push({
        id: "service-delete-current",
        name: t("commandPalette.deleteService", { name: currentService.name }),
        keywords: "eliminar apagar culto delete service",
        section: t("commandPalette.sections.currentService"),
        icon: <Trash2 className="w-4 h-4 text-rose-500" />,
        perform: async () => {
          await deleteService(currentService.id);
          navigate(`${slugPrefix}/services`);
        },
      });
    }

    return actions;
  }, [
    slugPrefix,
    view,
    currentSong,
    currentService,
    isSidebarCollapsed,
    navigate,
    logout,
    setCurrentFolderId,
    openModal,
    setIsSidebarCollapsed,
    handleViewModeChange,
    handlePrintSong,
    setMoveSongTarget,
    setTargetSongFolderId,
    setDeleteSongTarget,
    deleteService,
    fileInputRef,
    t,
  ]);

  return (
    <CommandPaletteProvider staticActions={staticActions}>
      <InnerPalette {...props} staticActions={staticActions} />
      {props.children}
    </CommandPaletteProvider>
  );
}

export const HosannaCommandPaletteTriggerButton: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { togglePalette } = useCommandPalette();
  return (
    <button
      onClick={togglePalette}
      className={`flex items-center gap-2 px-3 py-2 bg-m3-card hover:bg-m3-hover border border-m3-border rounded-2xl text-xs font-medium text-m3-secondary hover:text-m3-text transition-all cursor-pointer shadow-xs ${className || ""}`}
      title="Abrir Menu de Comandos (Ctrl+K / Cmd+K)"
    >
      <span className="hidden sm:inline font-semibold">Comandos</span>
      <kbd className="px-1.5 py-0.5 rounded-md bg-m3-bg border border-m3-border text-[10px] font-mono font-bold text-m3-secondary">
        ⌘K
      </kbd>
    </button>
  );
};
