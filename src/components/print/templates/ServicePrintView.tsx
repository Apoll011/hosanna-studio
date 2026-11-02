/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Service, ServiceElement, Song } from "@/src/types";
import React, { useMemo } from "react";
import { PrintBrand, PrintOptions } from "../types";
import { SongPrintView } from "./SongPrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface ServicePrintViewProps {
  service: Service;
  songs?: Song[];
  options: PrintOptions;
  brand: PrintBrand;
}

export function formatPrintDate(date: string, locale: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return s ? `${m}m ${s}s` : `${m} min`;
};

const formatOffset = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

export const ServicePrintView: React.FC<ServicePrintViewProps> = ({
  service,
  songs = [],
  options,
  brand,
}) => {
  const { t } = useI18n();

  const elements = useMemo(() => service.elements || [], [service.elements]);
  const totalSeconds = elements.reduce(
    (acc, el) => acc + (el.duration || 0),
    0,
  );
  const hasTiming = totalSeconds > 0;
  const hasPassages = elements.some((el) => el.passage);

  const startOffsets = useMemo(() => {
    let acc = 0;
    return elements.map((el) => {
      const start = acc;
      acc += el.duration || 0;
      return start;
    });
  }, [elements]);

  const songsToPrint = useMemo(() => {
    if (!options.includeSongs) return [];
    const byId = new Map(songs.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const result: Song[] = [];
    for (const el of elements) {
      const song = el.type === "song" && el.songId && byId.get(el.songId);
      if (song && !seen.has(song.id)) {
        seen.add(song.id);
        result.push(song);
      }
    }
    return result;
  }, [elements, songs, options.includeSongs]);

  const typeLabel = (type: ServiceElement["type"]) => {
    switch (type) {
      case "welcome":
        return t("print.service.types.welcome");
      case "scripture":
        return t("print.service.types.scripture");
      case "song":
        return t("print.service.types.song");
      case "message":
        return t("print.service.types.message");
      case "announcement":
        return t("print.service.types.announcement");
      default:
        return t("print.service.types.moment");
    }
  };

  return (
    <>
      <article className="hp-sheet hp-sheet--service">
        <TemplateHeader
          title={service.name}
          subtitle={formatPrintDate(service.date, brand.locale)}
          badge={t("print.service.badge")}
          options={options}
          brand={brand}
        />

        <section className="hp-block">
          <h2 className="hp-h2">
            <span>{t("print.service.order")}</span>
            {hasTiming && (
              <span className="hp-h2-aside">
                {t("print.service.totalDuration", {
                  duration: formatDuration(totalSeconds),
                })}
              </span>
            )}
          </h2>

          {elements.length === 0 ? (
            <p className="hp-empty">{t("print.service.noElements")}</p>
          ) : (
            <table className="hp-table">
              <thead>
                <tr>
                  <th className="hp-num">#</th>
                  {hasTiming && (
                    <th className="hp-right">{t("print.service.startCol")}</th>
                  )}
                  <th>{t("print.service.momentCol")}</th>
                  <th>{t("print.service.itemCol")}</th>
                  {hasPassages && <th>{t("print.service.passageCol")}</th>}
                  {hasTiming && (
                    <th className="hp-right">
                      {t("print.service.durationCol")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {elements.map((el, idx) => (
                  <tr key={el.id || idx}>
                    <td className="hp-num">{idx + 1}</td>
                    {hasTiming && (
                      <td className="hp-right hp-mono">
                        {formatOffset(startOffsets[idx])}
                      </td>
                    )}
                    <td>
                      <span className={`hp-tag hp-tag--${el.type}`}>
                        {typeLabel(el.type)}
                      </span>
                    </td>
                    <td>
                      <div className="hp-cell-title">{el.title}</div>
                      {el.type === "scripture" && el.content ? (
                        <div className="hp-cell-quote">{el.content}</div>
                      ) : (
                        el.content && (
                          <div className="hp-cell-sub">{el.content}</div>
                        )
                      )}
                      {el.notes && (
                        <div className="hp-cell-sub">
                          <em>{el.notes}</em>
                        </div>
                      )}
                    </td>
                    {hasPassages && (
                      <td className="hp-cell-title">{el.passage || ""}</td>
                    )}
                    {hasTiming && (
                      <td className="hp-right">
                        {formatDuration(el.duration) || (
                          <span className="hp-dim">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {service.notes && (
          <section className="hp-block hp-note">
            <div className="hp-note-label">{t("print.service.notes")}</div>
            <p>{service.notes}</p>
          </section>
        )}

        <TemplateFooter options={options} brand={brand} />
      </article>

      {songsToPrint.map((song) => (
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
