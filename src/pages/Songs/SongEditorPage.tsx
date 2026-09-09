/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChordProPreviewSettings } from "@/src/components/ChorproSettings";
import { Button, Spinner } from "@/src/components/common";
import { EditorSettingsPanel } from "@/src/components/EditorSettingsPanel";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useEditorSettings } from "@/src/hooks/useEditorSettings";
import { usePreviewSettings } from "@/src/hooks/usePreviewSettings";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import { Can } from "@/src/lib/permissions/components";
import { Song } from "@/src/types";
import { ChordProRenderer, parseChordPro } from "@hosanna/chordpro";
import { Editor } from "@hosanna/chordpro/editor";
import {
  ArrowLeft,
  Columns,
  EditIcon,
  File,
  HelpCircle,
  LayoutTemplate,
  PanelRight,
  Printer,
  Save,
  Settings,
  Settings2,
} from "lucide-react";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { HelpModal } from "../../components/modals/HelpModal";
import { useAuth } from "../../contexts/AuthContext";
import { usePrint } from "../../contexts/PrintContext";
import { useSong, useSongs } from "../../hooks/useSongs";
import { posthog } from "../../lib/posthog";

type LayoutMode = "editor" | "split" | "preview";

export const SongEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
  const { organization } = useAuth();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";

  const { granted: canUpdateSong } = useCan("song.update");

  const { data: song, isLoading, isError, error } = useSong(id || null);
  const { updateSong, isUpdating } = useSongs();
  const { printSong } = usePrint();

  const [content, setContent] = useState("");

  const deferredContent = useDeferredValue(content);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    canUpdateSong ? "split" : "preview",
  );

  useEffect(() => {
    setLayoutMode(canUpdateSong ? "split" : "preview");
  }, [canUpdateSong]);

  const [showEditorSettings, setShowEditorSettings] = useState(false);
  const [showPreviewSettings, setShowPreviewSettings] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const {
    settings: editorSettings,
    updateSetting: updateEditorSetting,
    resetSettings: resetEditorSettings,
  } = useEditorSettings();

  const { settings, updateSetting, resetSettings } = usePreviewSettings();
  const { fontSize, showDiagrams } = settings;

  const isSavingRef = useRef(false);

  const parsedSong = useMemo(() => parseChordPro(deferredContent), [deferredContent]);

  const transformedSong = useMemo(() => {
    let transformed = parsedSong
      .selectVariant(selectedVariant)
      .transpose(settings.transposeVal)
      .instrument(settings.instrument);
    if (!settings.showChords) transformed = transformed.removeChords(true);
    return transformed;
  }, [
    parsedSong,
    selectedVariant,
    settings.instrument,
    settings.showChords,
    settings.transposeVal,
  ]);

  useEffect(() => {
    if (song) {
      setContent(song.content);
      setHasUnsavedChanges(false);
    }
  }, [song?.id]);

  useEffect(() => {
    setSelectedVariant(null);
  }, [song?.id, deferredContent]);

  const handleSave = useCallback(
    async (updatedContent: string) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;

      try {
        if (!song) return;

        const parsed = parseChordPro(updatedContent);
        const meta = parsed.metadata;

        const updates: Partial<Song> = {
          content: updatedContent,
          updatedAt: song.updatedAt,
        };

        if (meta.title) updates.title = meta.title;
        if (meta.artist) updates.artist = meta.artist;
        if (meta.songNumber && Number(meta.songNumber))
          updates.song_number = Number(meta.songNumber);

        await updateSong({ id: song.id, data: updates });
        posthog.capture("song_saved", { layout_mode: layoutMode });
        setHasUnsavedChanges(false);
      } catch {
        // Error toast is already displayed by useSongMutations
      } finally {
        isSavingRef.current = false;
      }
    },
    [song, updateSong, layoutMode],
  );

  useEffect(() => {
    if (!hasUnsavedChanges || isUpdating || isSavingRef.current) return;

    const timer = setInterval(() => {
      handleSave(deferredContent);
    }, 60000);

    return () => clearInterval(timer);
  }, [hasUnsavedChanges, deferredContent, handleSave, isUpdating]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Spinner size="lg" label={t("songEditor.loading")} />
      </div>
    );
  }

  if (isError || !song) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t("songEditor.notFoundTitle")}
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {error ? (error as Error).message : t("songEditor.notFoundDesc")}
        </p>
        <Button
          variant="primary"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate(`${slugPrefix}/folders`);
            }
          }}
        >
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-m3-sidebar/10">
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
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-m3-text flex items-center gap-1.5">
                <File className="w-3.5 h-3.5 text-m3-primary" />
                {song.title || t("songEditor.untitled")}
              </span>
              {hasUnsavedChanges && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                  title={t("songEditor.unsaved")}
                />
              )}
            </div>
          </div>
        </div>

        <Can permission="song.update">
          <div className="hidden md:flex bg-m3-card/50 border border-m3-border rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode("editor")}
              className={`p-1.5 rounded-md transition-all ${layoutMode === "editor" ? "bg-m3-primary/10 text-m3-primary shadow-sm" : "text-m3-secondary hover:bg-m3-hover"}`}
              title={t("songEditor.editorOnly")}
            >
              <EditIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode("split")}
              className={`p-1.5 rounded-md transition-all ${layoutMode === "split" ? "bg-m3-primary/10 text-m3-primary shadow-sm" : "text-m3-secondary hover:bg-m3-hover"}`}
              title={t("songEditor.split")}
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode("preview")}
              className={`p-1.5 rounded-md transition-all ${layoutMode === "preview" ? "bg-m3-primary/10 text-m3-primary shadow-sm" : "text-m3-secondary hover:bg-m3-hover"}`}
              title={t("songEditor.previewOnly")}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-m3-secondary hover:text-m3-primary hover:bg-m3-primary/10 rounded-lg transition-all"
              title={t("songEditor.chordproHelp")}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-4 h-4 text-sky-500" />}
              onClick={() => {
                if (song) {
                  printSong(
                    { ...song, content },
                    {
                      showChords: settings.showChords,
                      fontSize: settings.fontSize,
                    },
                  );
                }
              }}
              title={t("print.buttons.printSong")}
              className="rounded-xl font-bold text-xs h-8"
            >
              <span className="hidden sm:inline">{t("common.print")}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              isLoading={isUpdating}
              onClick={() => handleSave(content)}
              className="rounded-xl font-bold text-xs h-8 ml-2"
            >
              {t("common.save")}
            </Button>
          </div>
        </Can>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Editor pane — always mounted so layout-mode switches animate smoothly */}
        <div
          className={[
            "flex flex-col overflow-hidden relative bg-m3-card min-w-0",
            "transition-all duration-300 ease-in-out",
            layoutMode === "preview" ? "max-md:hidden" : "",
            layoutMode === "editor"
              ? "h-full"
              : layoutMode === "split"
                ? "h-1/2"
                : "",
            "md:h-auto",
            layoutMode === "editor"
              ? "md:basis-full"
              : layoutMode === "split"
                ? "md:basis-1/2 md:border-r border-m3-border"
                : "md:basis-0",
            layoutMode === "preview" ? "md:opacity-0" : "md:opacity-100",
          ].join(" ")}
        >
          {/* Editor Tab Header */}
          <div className="h-9 bg-m3-sidebar/30 border-b border-m3-border flex items-center justify-between px-3 shrink-0">
            <span className="text-[10px] font-semibold text-m3-secondary uppercase tracking-wider flex items-center gap-1.5">
              <EditIcon className="w-3 h-3" />
              {t("songEditor.code")}
            </span>
            <button
              onClick={() => setShowEditorSettings(!showEditorSettings)}
              className={`p-1 rounded transition-colors ${showEditorSettings ? "bg-m3-primary/10 text-m3-primary" : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"}`}
              title={t("songEditor.editorSettings")}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Contextual Editor Settings Modal */}
          <EditorSettingsPanel
            isOpen={showEditorSettings}
            onClose={() => setShowEditorSettings(false)}
            settings={editorSettings}
            updateSetting={updateEditorSetting}
            resetSettings={resetEditorSettings}
          />

          <div className="flex-1 overflow-hidden relative">
            <Editor
              value={content}
              onChange={(val) => {
                setContent(val);
                setHasUnsavedChanges(true);
              }}
              settings={editorSettings}
              readOnly={!canUpdateSong}
              onSave={handleSave}
              mode="chordpro"
              fallback={
                <div className="h-full w-full flex items-center justify-center">
                  <Spinner size="md" label={t("songEditor.loadingEditor")} />
                </div>
              }
            />
          </div>
        </div>

        {/* Preview pane — always mounted so layout-mode switches animate smoothly */}
        <div
          className={[
            "flex flex-col overflow-hidden relative bg-m3-card min-w-0",
            "transition-all duration-300 ease-in-out",
            layoutMode === "editor" ? "max-md:hidden" : "",
            layoutMode === "preview"
              ? "h-full"
              : layoutMode === "split"
                ? "h-1/2"
                : "",
            "md:h-auto",
            layoutMode === "preview"
              ? "md:basis-full"
              : layoutMode === "split"
                ? "md:basis-1/2"
                : "md:basis-0",
            layoutMode === "editor" ? "md:opacity-0" : "md:opacity-100",
          ].join(" ")}
        >
          {/* Preview Tab Header */}
          <div className="h-9 bg-m3-sidebar/30 border-b border-m3-border flex items-center justify-between px-3 shrink-0">
            <span className="text-[10px] font-semibold text-m3-secondary uppercase tracking-wider flex items-center gap-1.5">
              <LayoutTemplate className="w-3 h-3" />
              {t("songEditor.preview")}
            </span>
            <div className="flex items-center gap-2">
              {parsedSong.variants && parsedSong.variants.length > 0 && (
                <select
                  value={selectedVariant ?? ""}
                  onChange={(event) =>
                    setSelectedVariant(event.target.value || null)
                  }
                  className="max-w-32 rounded-md border border-m3-border bg-m3-card px-1.5 py-1 text-[10px] text-m3-text"
                  aria-label={t("songEditor.variant")}
                >
                  <option value="">{t("songEditor.defaultVariant")}</option>
                  {parsedSong.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setShowPreviewSettings(!showPreviewSettings)}
                className={`p-1 rounded transition-colors ${showPreviewSettings ? "bg-m3-primary/10 text-m3-primary" : "text-m3-secondary hover:bg-m3-hover hover:text-m3-text"}`}
                title={t("songEditor.readingSettings")}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showPreviewSettings && (
            <ChordProPreviewSettings
              settings={settings}
              updateSetting={updateSetting}
              resetSettings={resetSettings}
              capo={transformedSong.metadata.capo}
            />
          )}
          <div
            className="flex-1 overflow-auto bg-m3-card relative"
            onClick={() => showPreviewSettings && setShowPreviewSettings(false)}
          >
            <ChordProRenderer
              song={transformedSong}
              fontSize={fontSize}
              showDiagrams={showDiagrams}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
