/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import {
  detectProvider,
  getOnlineChordProviders,
  getProviderNames,
  getProviderPlaceholder,
  parseUrlFallback,
} from "@/src/lib/providers/onlineChordProviders";
import { CifraResult } from "@/src/types";
import { getCifra } from "@/src/utils";
import { ConversionResult, convertToChordProDetailed } from "@hosanna/chordpro";
import { Check, Copy, FileText, Globe, Undo2 } from "lucide-react";
import React, { useMemo, useState } from "react";

type ImportTab = "online" | "raw";

/**
 * Best-effort extraction of the raw ChordPro text out of a ConversionResult.
 */
function extractChordProText(conversion: ConversionResult): string {
  if (conversion?.chordpro) return conversion.chordpro;
  const anyConversion = conversion as unknown as Record<string, unknown>;
  const candidate =
    anyConversion.chordPro ??
    anyConversion.text ??
    anyConversion.output ??
    anyConversion.content;

  if (typeof candidate === "string") return candidate;
  return JSON.stringify(conversion, null, 2);
}

export interface ThirdPartyProvidersModalProps {
  isOpen: boolean;
  handleClose: () => void;
  handleSave: (result: ConversionResult, artist: string, title: string) => void;
}

export const ThirdPartyProvidersModal: React.FC<
  ThirdPartyProvidersModalProps
> = ({ isOpen, handleClose, handleSave }) => {
  const { t } = useI18n();

  // Active tab: 'online' (link to CifraClub/UltimateGuitar/etc) or 'raw' (pasted text)
  const [activeTab, setActiveTab] = useState<ImportTab>("online");

  // Online import state
  const [urlInput, setUrlInput] = useState("");

  // Raw text import state
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [rawText, setRawText] = useState("");

  // General modal state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const providers = useMemo(() => getOnlineChordProviders(), []);
  const providerNames = useMemo(() => getProviderNames(), []);
  const placeholderUrl = useMemo(() => getProviderPlaceholder(), []);

  const detectedOnlineProvider = useMemo(() => {
    if (!urlInput.trim()) return null;
    return detectProvider(urlInput);
  }, [urlInput]);

  const resetState = () => {
    setUrlInput("");
    setSongTitle("");
    setArtist("");
    setRawText("");
    setError(null);
    setIsLoading(false);
    setPreviewText(null);
    setCopied(false);
    setActiveTab("online");
  };

  const resetAndClose = () => {
    resetState();
    handleClose();
  };

  const handleCopy = async () => {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("modals.copyFailed"));
    }
  };

  const handleOnlineImport = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setError(t("modals.pleaseEnterLink"));
      return;
    }

    const provider = detectProvider(trimmedUrl);
    if (!provider) {
      setError(t("modals.pleaseEnterValidLink", { providers: providerNames }));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result: CifraResult = await getCifra(trimmedUrl);

      if (result.error || !result.cifra) {
        setError(
          t("modals.errorGetCifra", {
            error: result.error || t("modals.cifraNotFound"),
          }),
        );
        return;
      }

      const fallback = parseUrlFallback(trimmedUrl);
      const parsedArtist =
        result.artist?.trim() || fallback.artist || t("forms.unknownArtist");
      const parsedTitle =
        result.name?.trim() || fallback.title || t("forms.untitled");

      const conversion = convertToChordProDetailed(result.cifra, {
        strictChordDetection: false,
      });

      if (previewOnly) {
        setPreviewText(extractChordProText(conversion));
      } else {
        handleSave(conversion, parsedArtist, parsedTitle);
        resetAndClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("modals.unexpectedError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRawImport = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedText = rawText.trim();
    if (!trimmedText) {
      setError(t("modals.pleaseEnterText"));
      return;
    }

    const trimmedTitle = songTitle.trim();
    if (!trimmedTitle) {
      setError(t("modals.pleaseEnterSongTitle"));
      return;
    }

    const trimmedArtist = artist.trim() || t("forms.unknownArtist");

    setError(null);
    setIsLoading(true);

    try {
      const conversion = convertToChordProDetailed(trimmedText, {
        strictChordDetection: false,
      });

      if (previewOnly) {
        setPreviewText(extractChordProText(conversion));
      } else {
        handleSave(conversion, trimmedArtist, trimmedTitle);
        resetAndClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("modals.unexpectedError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={t("modals.thirdPartyProvidersTitle")}
    >
      {previewText !== null ? (
        <div className="space-y-4 py-2">
          <p className="text-xs text-m3-secondary bg-m3-sidebar/60 p-2.5 rounded-xl border border-m3-border">
            {t("modals.chordProPreviewHint")}
          </p>

          <textarea
            readOnly
            value={previewText}
            rows={12}
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-m3-border bg-m3-sidebar/50 text-m3-text focus:outline-none focus:ring-2 focus:ring-m3-primary"
          />

          <div className="flex items-center justify-between pt-4 border-t border-m3-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPreviewText(null)}
              className="flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              {t("modals.backToEdit")}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAndClose}
              >
                {t("common.close")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCopy}
                className="flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t("modals.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {t("modals.copyChordPro")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-1">
          {/* Tabs header */}
          <div className="flex items-center p-1 bg-m3-sidebar/60 border border-m3-border rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab("online");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "online"
                  ? "bg-m3-card text-m3-primary shadow-xs font-bold"
                  : "text-m3-secondary hover:text-m3-text"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {t("modals.tabOnline")}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("raw");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "raw"
                  ? "bg-m3-card text-m3-primary shadow-xs font-bold"
                  : "text-m3-secondary hover:text-m3-text"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {t("modals.tabRawText")}
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 text-xs font-semibold text-m3-danger bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800/80">
              {error}
            </div>
          )}

          {/* TAB 1: ONLINE PROVIDERS */}
          {activeTab === "online" && (
            <form onSubmit={handleOnlineImport} className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-m3-secondary bg-m3-sidebar/60 p-2.5 rounded-xl border border-m3-border">
                  {t("modals.pasteLink")}
                </p>

                {/* Supported providers list badge */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-m3-secondary font-medium">
                    {t("modals.supportedProviders")}:
                  </span>
                  {providers.map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-m3-primary/10 text-m3-primary border border-m3-primary/20"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-m3-text">
                    {t("modals.songLink")}
                  </label>
                  {detectedOnlineProvider && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {detectedOnlineProvider.name}
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={placeholderUrl}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-m3-border bg-m3-sidebar/50 text-m3-text focus:outline-none focus:ring-2 focus:ring-m3-primary"
                  autoFocus
                />
              </div>

              {/* Preview-only toggle */}
              <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-m3-border bg-m3-sidebar/50 dark:bg-m3-card/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-m3-text">
                    {t("modals.showChordProOnlyLabel")}
                  </p>
                  <p className="text-[11px] text-m3-secondary">
                    {t("modals.showChordProOnlyHint")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={previewOnly}
                  onClick={() => setPreviewOnly((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    previewOnly ? "bg-m3-primary" : "bg-m3-border"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      previewOnly ? "translate-x-4.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-m3-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAndClose}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isLoading || !urlInput.trim()}
                >
                  {isLoading
                    ? t("modals.importing")
                    : previewOnly
                      ? t("modals.generateChordPro")
                      : t("modals.importCifra")}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: RAW TEXT IMPORT */}
          {activeTab === "raw" && (
            <form onSubmit={handleRawImport} className="space-y-4">
              <p className="text-xs text-m3-secondary bg-m3-sidebar/60 p-2.5 rounded-xl border border-m3-border">
                {t("modals.rawTextDesc")}
              </p>

              {/* Song Title and Artist Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={t("modals.songTitle")}
                  value={songTitle}
                  onChange={(e) => {
                    setSongTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("modals.songTitlePlaceholder")}
                  required
                  autoFocus
                />
                <Input
                  label={t("modals.artist")}
                  value={artist}
                  onChange={(e) => {
                    setArtist(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("modals.artistPlaceholder")}
                />
              </div>

              {/* Raw Cifra Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-m3-text">
                  {t("modals.rawTextLabel")}
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    if (error) setError(null);
                  }}
                  rows={9}
                  placeholder={`C        F/G    C\nSalvador maravilhoso\nC/E      F          G4   G\nDeus-que-tomou-meu-lugar\nAm             G         F\nCordeiro entregue ao Calvário\nC/G       G4     Am   F\nMorto pra nos salvar, ô, ô, ô\nC/G       G4     C\nMorto pra nos salvar`}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-m3-border bg-m3-sidebar/50 text-m3-text focus:outline-none focus:ring-2 focus:ring-m3-primary leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Preview-only toggle */}
              <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-m3-border bg-m3-sidebar/50 dark:bg-m3-card/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-m3-text">
                    {t("modals.showChordProOnlyLabel")}
                  </p>
                  <p className="text-[11px] text-m3-secondary">
                    {t("modals.showChordProOnlyHint")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={previewOnly}
                  onClick={() => setPreviewOnly((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    previewOnly ? "bg-m3-primary" : "bg-m3-border"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      previewOnly ? "translate-x-4.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-m3-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAndClose}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isLoading || !rawText.trim() || !songTitle.trim()}
                >
                  {isLoading
                    ? t("modals.importing")
                    : previewOnly
                      ? t("modals.generateChordPro")
                      : t("modals.importCifra")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};

// Backward-compatible alias for existing imports
export const CifraClubImportModal = ThirdPartyProvidersModal;
