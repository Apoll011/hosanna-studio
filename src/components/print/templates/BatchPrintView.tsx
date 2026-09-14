/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React from "react";
import { PrintItem, PrintOptions } from "../types";
import { CollectionPrintView } from "./CollectionPrintView";
import { EventPrintView } from "./EventPrintView";
import { FolderPrintView } from "./FolderPrintView";
import { ServicePrintView } from "./ServicePrintView";
import { SongPrintView } from "./SongPrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface BatchPrintViewProps {
  items: PrintItem[];
  title?: string;
  options: PrintOptions;
  churchName?: string;
  churchLogo?: string | null;
  churchShortName?: string;
  accentColor?: string;
}

export const BatchPrintView: React.FC<BatchPrintViewProps> = ({
  items,
  title,
  options,
  churchName,
  churchLogo,
  churchShortName,
  accentColor,
}) => {
  const { t } = useI18n();
  const { pageBreakBetweenItems, templateFamily } = options;

  // If there are multiple items and a title is specified, show a Batch Cover Summary
  const showCover = items.length > 2 && !!title;

  return (
    <div className="batch-print-container">
      {/* ── BATCH COVER SUMMARY ── */}
      {showCover && (
        <div
          className={`print-sheet print:break-inside-auto print:page-break-after-always bg-white text-slate-900 print:text-black p-8 max-w-4xl mx-auto ${
            templateFamily === "classic"
              ? "font-serif"
              : templateFamily === "contemporary"
                ? "font-sans"
                : "font-sans"
          }`}
        >
          <div>
            <TemplateHeader
              churchName={churchName}
              churchLogo={churchLogo}
              churchShortName={churchShortName}
              accentColor={accentColor}
              title={title}
              subtitle={t("print.batch.coverSubtitle", {
                count: String(items.length),
              })}
              metaBadge={t("print.batch.badge")}
              options={options}
            />

            <div className="my-8">
              <h2
                className={`text-sm font-bold uppercase tracking-wider mb-4 pb-1 border-b ${
                  templateFamily === "classic"
                    ? "font-serif border-slate-900"
                    : templateFamily === "contemporary"
                      ? "font-mono font-black border-slate-950 text-slate-950"
                      : "text-slate-700 border-slate-200"
                }`}
              >
                {t("print.batch.content")}
              </h2>

              <ul className="space-y-2 text-xs">
                {items.map((item, idx) => {
                  let label = "";
                  let typeLabel = "";

                  if (item.type === "song") {
                    typeLabel = t("print.batch.types.song");
                    label = item.data.title;
                  } else if (item.type === "folder") {
                    typeLabel = t("print.batch.types.folder");
                    label = item.data.name;
                  } else if (item.type === "collection") {
                    typeLabel = t("print.batch.types.collection");
                    label = item.data.name;
                  } else if (item.type === "service") {
                    typeLabel = t("print.batch.types.service");
                    label = item.data.name;
                  } else if (item.type === "event") {
                    typeLabel = t("print.batch.types.event");
                    label = item.data.title;
                  }

                  return (
                    <li
                      key={idx}
                      className="flex items-center justify-between py-1.5 border-b border-slate-100"
                    >
                      <span className="font-semibold text-slate-800">
                        {idx + 1}. {label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        {typeLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <TemplateFooter options={options} churchName={churchName} />
        </div>
      )}

      {/* ── RENDER EACH ITEM ── */}
      {items.map((item, index) => {
        const key = `${item.type}-${item.data.id || index}`;

        return (
          <div
            key={key}
            className={
              pageBreakBetweenItems && index < items.length - 1
                ? "print:page-break-after-always"
                : ""
            }
          >
            {item.type === "song" && (
              <SongPrintView
                song={item.data}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            )}

            {item.type === "folder" && (
              <FolderPrintView
                folder={item.data}
                songs={item.songs}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            )}

            {item.type === "collection" && (
              <CollectionPrintView
                collection={item.data}
                songs={item.songs}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            )}

            {item.type === "service" && (
              <ServicePrintView
                service={item.data}
                songs={item.songs}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            )}

            {item.type === "event" && (
              <EventPrintView
                event={item.data}
                categories={item.categories}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
