/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import React, { useMemo } from "react";
import { PrintBrand, PrintOptions } from "../types";
import { PrintSheet } from "./PrintSheet";
import { SongPrintView } from "./SongPrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface SongbookPrintViewProps {
  name: string;
  description?: string | null;
  badge: string;
  emptyText: string;
  songs: Song[];
  options: PrintOptions;
  brand: PrintBrand;
}

/** Folder and collection printouts: a compact index sheet, then the songs. */
export const SongbookPrintView: React.FC<SongbookPrintViewProps> = ({
  name,
  description,
  badge,
  emptyText,
  songs,
  options,
  brand,
}) => {
  const { t, tc } = useI18n();

  // Index uses Song fields only — never parse ChordPro for the TOC.
  const rows = useMemo(
    () =>
      songs.map((song, idx) => ({
        id: song.id,
        number: song.song_number ?? idx + 1,
        title: song.title || "—",
      })),
    [songs],
  );

  const indexClass = rows.length > 48 ? "hp-index hp-index--dense" : "hp-index";
  const pack = options.packSongsOnPage;

  const songViews = songs.map((song) => (
    <SongPrintView
      key={song.id}
      song={song}
      options={options}
      brand={brand}
      packed={pack}
    />
  ));

  return (
    <>
      <PrintSheet
        className="hp-sheet--index"
        footer={<TemplateFooter options={options} brand={brand} />}
      >
        <TemplateHeader
          title={name}
          subtitle={tc("print.songbook.songCount", songs.length)}
          badge={badge}
          options={options}
          brand={brand}
        />

        {description && (
          <div className="hp-block hp-note">
            <p>{description}</p>
          </div>
        )}

        <section className="hp-block">
          <h2 className="hp-h2">
            <span>{t("print.songbook.index")}</span>
          </h2>
          {rows.length === 0 ? (
            <p className="hp-empty">{emptyText}</p>
          ) : (
            <div className={indexClass}>
              {rows.map((row) => (
                <div key={row.id} className="hp-index-row">
                  <span className="hp-index-num">{row.number}</span>
                  <span className="hp-index-title">{row.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </PrintSheet>

      {options.includeSongs &&
        (pack ? <div className="hp-song-pack">{songViews}</div> : songViews)}
    </>
  );
};
