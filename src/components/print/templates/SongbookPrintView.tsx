/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import React, { useMemo } from "react";
import { PrintBrand, PrintOptions } from "../types";
import { PrintSheet } from "./PrintSheet";
import { SongPrintView, safeParseSong } from "./SongPrintView";
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

/** Folder and collection printouts: an index sheet followed by the songs. */
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

  const rows = useMemo(
    () =>
      songs.map((song, idx) => {
        const meta = safeParseSong(song.content)?.metadata ?? {};
        return {
          song,
          number: song.song_number ?? meta.songNumber ?? idx + 1,
          title: meta.title || song.title,
          artist: meta.artist || song.artist,
          key: meta.key,
        };
      }),
    [songs],
  );
  const hasKeys = rows.some((r) => r.key);

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
            <table className="hp-table">
              <thead>
                <tr>
                  <th className="hp-num">#</th>
                  <th>{t("print.songbook.titleCol")}</th>
                  <th>{t("print.songbook.artistCol")}</th>
                  {hasKeys && (
                    <th className="hp-center">{t("print.song.key")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.song.id}>
                    <td className="hp-num">{row.number}</td>
                    <td className="hp-cell-title">{row.title}</td>
                    <td>{row.artist || <span className="hp-dim">—</span>}</td>
                    {hasKeys && (
                      <td className="hp-center hp-mono">{row.key || "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </PrintSheet>

      {options.includeSongs &&
        songs.map((song) => (
          <SongPrintView
            key={song.id}
            song={song}
            options={options}
            brand={brand}
          />
        ))}
    </>
  );
};
