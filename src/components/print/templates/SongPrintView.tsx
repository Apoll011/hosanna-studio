/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import { ChordProRenderer, parseChordPro } from "@hosanna/chordpro";
import React, { useMemo } from "react";
import { PrintOptions } from "../types";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface SongPrintViewProps {
  song: Song;
  options: PrintOptions;
  churchName?: string;
  churchLogo?: string | null;
  churchShortName?: string;
  accentColor?: string;
  pageNumber?: number;
}

export const SongPrintView: React.FC<SongPrintViewProps> = ({
  song,
  options,
  churchName,
  churchLogo,
  churchShortName,
  accentColor,
}) => {
  const parsedMeta = useMemo(() => {
    try {
      const parsed = parseChordPro(song.content || "");
      return parsed.metadata || {};
    } catch {
      return {};
    }
  }, [song.content]);

  const transformedSong = useMemo(() => {
    let transformed = parseChordPro(song.content || "");
    if (!options.showChords) transformed = transformed.removeChords(true);
    return transformed;
  }, [song.content, options.showChords]);

  const { t } = useI18n();

  const title = parsedMeta.title || song.title;
  const artist = parsedMeta.artist || song.artist;
  const key = parsedMeta.key;
  const tempo = parsedMeta.tempo;
  const time = parsedMeta.time;
  const capo = parsedMeta.capo;
  const ccli = parsedMeta.ccli;
  const copyright = parsedMeta.copyright;

  const { templateFamily, showMetadata } = options;

  // Build meta string / badges
  const metaBadge = key ? t("print.song.key", { key }) : undefined;

  return (
    <div
      className={`print-sheet print:break-inside-auto print:page-break-after-always bg-white text-slate-900 print:text-black p-6 sm:p-8 max-w-4xl mx-auto ${
        templateFamily === "classic"
          ? "font-serif"
          : templateFamily === "contemporary"
            ? "font-sans"
            : templateFamily === "compact"
              ? "p-4 sm:p-5"
              : "font-sans"
      }`}
    >
      <TemplateHeader
        churchName={churchName}
        churchLogo={churchLogo}
        churchShortName={churchShortName}
        accentColor={accentColor}
        title={title}
        subtitle={artist}
        metaBadge={templateFamily !== "contemporary" ? metaBadge : undefined}
        options={options}
      />

      {/* METADATA BAR */}
      {showMetadata && (key || tempo || time || capo) && (
        <div
          className={`flex flex-wrap items-center gap-2 mb-4 pb-3 text-xs ${
            templateFamily === "classic"
              ? "border-b border-slate-300 italic justify-center text-slate-700 font-serif"
              : templateFamily === "contemporary"
                ? "bg-slate-100 border-2 border-slate-950 p-2.5 rounded font-mono font-bold justify-between text-slate-950"
                : templateFamily === "compact"
                  ? "border-b border-slate-200 pb-1 mb-2 text-[10px] text-slate-600 gap-3"
                  : "border-b border-slate-100 text-slate-600"
          }`}
        >
          {templateFamily === "contemporary" ? (
            <>
              <div className="flex items-center gap-4">
                {key && <span>KEY: {key}</span>}
                {capo && <span>CAPO: {capo}</span>}
                {tempo && <span>BPM: {tempo}</span>}
                {time && <span>TIME: {time}</span>}
              </div>
              {artist && (
                <span className="text-[10px] uppercase tracking-wider text-slate-600">
                  {artist}
                </span>
              )}
            </>
          ) : templateFamily === "classic" ? (
            <div className="flex items-center gap-4">
              {key && <span>{t("print.song.key", { key })}</span>}
              {capo && <span>{t("print.song.capoClassic", { capo })}</span>}
              {tempo && <span>{t("print.song.tempoClassic", { tempo })}</span>}
              {time && <span>{t("print.song.timeClassic", { time })}</span>}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {key && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  {t("print.song.key", { key })}
                </span>
              )}
              {capo && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  {t("print.song.capo", { capo })}
                </span>
              )}
              {tempo && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  {t("print.song.tempo", { tempo })}
                </span>
              )}
              {time && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  {t("print.song.time", { time })}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHORDPRO RENDERER CONTAINER */}
      <div className="print-chordpro-content my-4 [&_.print-song-card>div.border-b:first-child]:hidden [&_.print-song-card_button]:hidden [&_.print-song-card_select]:hidden">
        <ChordProRenderer
          song={transformedSong}
          twoColumnLayout={options.twoColumnLayout}
          fontSize={options.fontSize}
          showDiagrams={false}
        />
      </div>

      <TemplateFooter
        options={options}
        churchName={churchName}
        ccli={ccli}
        copyright={copyright}
      />
    </div>
  );
};
