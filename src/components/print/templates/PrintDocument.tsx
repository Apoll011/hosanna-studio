/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React from "react";
import { documentStyleVars } from "../printStyles";
import { PrintBrand, PrintItem, PrintOptions } from "../types";
import { EventPrintView } from "./EventPrintView";
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
    options.pageBreakBetweenItems ? "hp-breaks" : "",
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

  return (
    <div
      className={printDocumentClassName(options)}
      style={
        documentStyleVars(options, brand.accentColor) as React.CSSProperties
      }
    >
      {showCover && (
        <article className="hp-sheet hp-sheet--cover">
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
          <TemplateFooter options={options} brand={brand} />
        </article>
      )}

      {items.map((item, index) => {
        const key = `${item.type}-${item.data.id || index}`;
        switch (item.type) {
          case "song":
            return (
              <SongPrintView
                key={key}
                song={item.data}
                options={options}
                brand={brand}
              />
            );
          case "folder":
            return (
              <SongbookPrintView
                key={key}
                name={item.data.name}
                badge={t("print.batch.types.folder")}
                emptyText={t("print.songbook.emptyFolder")}
                songs={item.songs ?? []}
                options={options}
                brand={brand}
              />
            );
          case "collection":
            return (
              <SongbookPrintView
                key={key}
                name={item.data.name}
                description={item.data.description}
                badge={t("print.batch.types.collection")}
                emptyText={t("print.songbook.emptyCollection")}
                songs={item.songs ?? []}
                options={options}
                brand={brand}
              />
            );
          case "service":
            return (
              <ServicePrintView
                key={key}
                service={item.data}
                songs={item.songs}
                options={options}
                brand={brand}
              />
            );
          case "event":
            return (
              <EventPrintView
                key={key}
                event={item.data}
                categories={item.categories}
                options={options}
                brand={brand}
              />
            );
        }
      })}
    </div>
  );
};
