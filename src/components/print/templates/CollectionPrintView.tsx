/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Collection, Song } from "@/src/types";
import { useI18n } from "@/src/lib/i18n";
import { parseChordPro } from "@hosanna/chordpro";
import React from "react";
import { PrintOptions } from "../types";
import { SongPrintView } from "./SongPrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface CollectionPrintViewProps {
  collection: Collection;
  songs?: Song[];
  options: PrintOptions;
  churchName?: string;
  churchLogo?: string | null;
  churchShortName?: string;
  accentColor?: string;
}

export const CollectionPrintView: React.FC<CollectionPrintViewProps> = ({
  collection,
  songs = [],
  options,
  churchName,
  churchLogo,
  churchShortName,
  accentColor,
}) => {
  const { t } = useI18n();
  const { templateFamily, includeFolderSongs, includeCollectionSongs } = options;
  const shouldIncludeSongs = includeCollectionSongs ?? includeFolderSongs;

  return (
    <div className="collection-print-container">
      {/* ── COLLECTION COVER / TABLE OF CONTENTS ── */}
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
        <div>
          <TemplateHeader
            churchName={churchName}
            churchLogo={churchLogo}
            churchShortName={churchShortName}
            accentColor={accentColor}
            title={collection.name}
            subtitle={t("print.collection.songbookSubtitle", {
              count: String(songs.length),
            })}
            metaBadge={t("print.collection.badge")}
            options={options}
          />

          <div className="my-6">
            <h2
              className={`text-sm font-bold uppercase tracking-wider mb-3 pb-1 border-b ${
                templateFamily === "classic"
                  ? "font-serif border-slate-900 text-center"
                  : templateFamily === "contemporary"
                    ? "font-mono font-black border-slate-950 text-slate-950"
                    : "text-slate-700 border-slate-200"
              }`}
            >
              {t("print.collection.index")}
            </h2>

            {songs.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                {t("print.collection.empty")}
              </p>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr
                    className={`border-b ${
                      templateFamily === "contemporary"
                        ? "border-slate-950 text-slate-950 font-mono font-bold"
                        : "border-slate-200 text-slate-500 font-semibold"
                    }`}
                  >
                    <th className="py-2 px-2 w-12 text-center">
                      {t("print.collection.numberCol")}
                    </th>
                    <th className="py-2 px-2">{t("print.collection.titleCol")}</th>
                    <th className="py-2 px-2">{t("print.collection.artistCol")}</th>
                    <th className="py-2 px-2 w-20 text-center">
                      {t("print.collection.keyCol")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {songs.map((song, idx) => {
                    let songKey = "";
                    try {
                      const parsed = parseChordPro(song.content || "");
                      songKey = parsed.metadata?.key || "";
                    } catch {
                      // ignore
                    }

                    return (
                      <tr
                        key={song.id}
                        className={
                          templateFamily === "classic"
                            ? "font-serif"
                            : undefined
                        }
                      >
                        <td className="py-2 px-2 text-center font-mono text-slate-400">
                          {song.song_number || idx + 1}
                        </td>
                        <td className="py-2 px-2 font-bold text-slate-900">
                          {song.title}
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {song.artist || "—"}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-semibold text-slate-700">
                          {songKey || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <TemplateFooter options={options} churchName={churchName} />
      </div>

      {/* ── FULL SONGS IN COLLECTION (IF ENABLED) ── */}
      {shouldIncludeSongs &&
        songs.map((song) => (
          <SongPrintView
            key={song.id}
            song={song}
            options={options}
            churchName={churchName}
            churchLogo={churchLogo}
            churchShortName={churchShortName}
            accentColor={accentColor}
          />
        ))}
    </div>
  );
};
