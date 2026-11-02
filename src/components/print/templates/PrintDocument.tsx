/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React, { useMemo } from "react";
import { documentStyleVars } from "../printStyles";
import { PrintBrand, PrintItem, PrintOptions } from "../types";
import { EventPrintView } from "./EventPrintView";
import { PrintSheet } from "./PrintSheet";
import { ServicePrintView } from "./ServicePrintView";
import { SongbookPrintView } from "./SongbookPrintView";
import { SongPrintView } from "./SongPrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface PrintDocumentProps {
  items: PrintItem[];
  title?: string;
  options: PrintOptions;
  brand: PrintBrand;
}

export function printDocumentClassName(options: PrintOptions): string {
  return [
    "hp-doc",
    `hp-theme-${options.templateFamily}`,
    `hp-density-${options.density}`,
    // Always on: packing still needs a page break after the index/rundown.
    // Per-song breaks are controlled by `pageBreakBetweenItems` inside views.
    "hp-breaks",
  ]
    .filter(Boolean)
    .join(" ");
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  items,
  title,
  options,
  brand,
}) => {
  const { t, tc } = useI18n();
  const showCover = items.length > 2 && !!title;
  const pack = !options.pageBreakBetweenItems;

  const topLevelSongCount = useMemo(
    () => items.filter((item) => item.type === "song").length,
    [items],
  );

  const itemLabel = (item: PrintItem) => {
    switch (item.type) {
      case "song":
        return { label: item.data.title, type: t("print.batch.types.song") };
      case "folder":
        return { label: item.data.name, type: t("print.batch.types.folder") };
      case "collection":
        return {
          label: item.data.name,
          type: t("print.batch.types.collection"),
        };
      case "service":
        return { label: item.data.name, type: t("print.batch.types.service") };
      case "event":
        return { label: item.data.title, type: t("print.batch.types.event") };
    }
  };

  const body: React.ReactNode[] = [];
  let songOrdinal = 0;
  for (let index = 0; index < items.length;) {
    const item = items[index];
    const key = `${item.type}-${item.data.id || index}`;

    if (item.type === "song" && pack) {
      const start = index;
      const group: PrintItem[] = [];
      while (index < items.length && items[index].type === "song") {
        group.push(items[index]);
        index += 1;
      }
      body.push(
        <div className="hp-song-pack" key={`pack-${start}`}>
          {group.map((songItem, groupIndex) => {
            if (songItem.type !== "song") return null;
            const showChurch =
              !showCover && songOrdinal === 0 && groupIndex === 0;
            songOrdinal += 1;
            return (
              <SongPrintView
                key={`${songItem.data.id || start + groupIndex}`}
                song={songItem.data}
                options={options}
                brand={brand}
                packed
                showChurchIdentity={showChurch}
              />
            );
          })}
        </div>,
      );
      continue;
    }

    switch (item.type) {
      case "song": {
        const showChurch =
          !showCover && (topLevelSongCount <= 1 || songOrdinal === 0);
        songOrdinal += 1;
        body.push(
          <SongPrintView
            key={key}
            song={item.data}
            options={options}
            brand={brand}
            showChurchIdentity={showChurch}
          />,
        );
        break;
      }
      case "folder":
        body.push(
          <SongbookPrintView
            key={key}
            name={item.data.name}
            badge={t("print.batch.types.folder")}
            emptyText={t("print.songbook.emptyFolder")}
            songs={item.songs ?? []}
            options={options}
            brand={brand}
          />,
        );
        break;
      case "collection":
        body.push(
          <SongbookPrintView
            key={key}
            name={item.data.name}
            description={item.data.description}
            badge={t("print.batch.types.collection")}
            emptyText={t("print.songbook.emptyCollection")}
            songs={item.songs ?? []}
            options={options}
            brand={brand}
          />,
        );
        break;
      case "service":
        body.push(
          <ServicePrintView
            key={key}
            service={item.data}
            songs={item.songs}
            options={options}
            brand={brand}
          />,
        );
        break;
      case "event":
        body.push(
          <EventPrintView
            key={key}
            event={item.data}
            categories={item.categories}
            options={options}
            brand={brand}
          />,
        );
        break;
    }
    index += 1;
  }

  return (
    <div
      className={printDocumentClassName(options)}
      style={
        documentStyleVars(options, brand.accentColor) as React.CSSProperties
      }
    >
      {showCover && (
        <PrintSheet
          className="hp-sheet--cover"
          footer={<TemplateFooter options={options} brand={brand} />}
        >
          <TemplateHeader
            title={title}
            subtitle={tc("print.batch.itemCount", items.length)}
            badge={t("print.batch.badge")}
            options={options}
            brand={brand}
          />
          <section className="hp-block">
            <h2 className="hp-h2">
              <span>{t("print.batch.content")}</span>
            </h2>
            <ol className="hp-toc">
              {items.map((item, idx) => {
                const { label, type } = itemLabel(item);
                return (
                  <li key={idx}>
                    <span className="hp-toc-num">{idx + 1}</span>
                    <span className="hp-toc-title">{label}</span>
                    <span className="hp-toc-dots" />
                    <span className="hp-toc-type">{type}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        </PrintSheet>
      )}

      {body}
    </div>
  );
};
