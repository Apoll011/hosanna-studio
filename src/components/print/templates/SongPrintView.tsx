/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import { parseChordPro, SongAST } from "@hosanna/chordpro";
import React, { useMemo } from "react";
import { buildSongBlocks } from "../songBlocks";
import { PrintBrand, PrintOptions } from "../types";
import { PrintSongBody } from "./PrintSongBody";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface SongPrintViewProps {
  song: Song;
  options: PrintOptions;
  brand: PrintBrand;
}

export function safeParseSong(content: string): SongAST | null {
  try {
    return parseChordPro(content || "");
  } catch {
    return null;
  }
}

export const SongPrintView: React.FC<SongPrintViewProps> = ({
  song,
  options,
  brand,
}) => {
  const { t } = useI18n();
  const { showChords } = options;

  const parsed = useMemo(() => safeParseSong(song.content), [song.content]);
  const blocks = useMemo(() => {
    if (!parsed) return [];
    const display = showChords ? parsed : parsed.removeChords(true);
    return buildSongBlocks(display, { showChords });
  }, [parsed, showChords]);

  const meta = parsed?.metadata ?? {};
  const title = meta.title || song.title;
  const subtitle = [meta.subtitle, meta.artist || song.artist]
    .filter(Boolean)
    .join(" · ");
  const number = meta.songNumber || song.song_number;

  const metaItems = [
    { label: t("print.song.key"), value: meta.key },
    {
      label: t("print.song.capo"),
      value: meta.capo && meta.capo !== "0" ? meta.capo : undefined,
    },
    {
      label: t("print.song.tempo"),
      value: meta.tempo ? `${meta.tempo} BPM` : undefined,
    },
    { label: t("print.song.time"), value: meta.time },
  ].filter((item) => item.value);

  return (
    <article className="hp-sheet hp-sheet--song">
      <TemplateHeader
        title={title}
        subtitle={subtitle || undefined}
        badge={number ? t("print.song.number", { number }) : undefined}
        options={options}
        brand={brand}
      />

      {options.showMetadata && metaItems.length > 0 && (
        <div className="hp-meta">
          {metaItems.map((item) => (
            <span key={item.label} className="hp-meta-item">
              <span className="hp-meta-label">{item.label}</span>
              <span className="hp-meta-value">{item.value}</span>
            </span>
          ))}
        </div>
      )}

      {blocks.length > 0 ? (
        <PrintSongBody
          blocks={blocks}
          showChords={showChords}
          showLabels={options.showSectionLabels}
          twoColumns={options.twoColumnLayout}
        />
      ) : (
        <p className="hp-empty">{t("print.song.empty")}</p>
      )}

      <TemplateFooter
        options={options}
        brand={brand}
        ccli={meta.ccli}
        copyright={meta.copyright}
      />
    </article>
  );
};
