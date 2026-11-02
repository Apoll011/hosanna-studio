/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { AgendaEvent, ResponsibilityCategory } from "@/src/types";
import React, { useMemo } from "react";
import { PrintBrand, PrintOptions } from "../types";
import { PrintSheet } from "./PrintSheet";
import { formatPrintDate } from "./ServicePrintView";
import { TemplateFooter } from "./TemplateFooter";
import { TemplateHeader } from "./TemplateHeader";

interface EventPrintViewProps {
  event: AgendaEvent;
  categories?: ResponsibilityCategory[];
  options: PrintOptions;
  brand: PrintBrand;
}

function timeRange(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!match || !minutes) return time;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = (start + minutes) % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${time} – ${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

export const EventPrintView: React.FC<EventPrintViewProps> = ({
  event,
  categories = [],
  options,
  brand,
}) => {
  const { t } = useI18n();

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const duration = event.durationMinutes || 60;
  const responsibilities = event.responsibilities || [];

  return (
    <PrintSheet
      className="hp-sheet--event"
      footer={<TemplateFooter options={options} brand={brand} />}
    >
      <TemplateHeader
        title={event.title}
        subtitle={formatPrintDate(event.date, brand.locale)}
        badge={t("print.event.badge")}
        options={options}
        brand={brand}
      />

      <dl className="hp-block hp-facts">
        <div className="hp-fact">
          <dt>{t("print.event.time")}</dt>
          <dd>
            {timeRange(event.time, duration)} ({duration} min)
          </dd>
        </div>
        <div className="hp-fact">
          <dt>{t("print.event.location")}</dt>
          <dd>{event.location || t("print.event.defaultLocation")}</dd>
        </div>
        <div className="hp-fact">
          <dt>{t("print.event.eventType")}</dt>
          <dd>{event.type || t("print.event.defaultType")}</dd>
        </div>
      </dl>

      <section className="hp-block">
        <h2 className="hp-h2">
          <span>{t("print.event.roster")}</span>
        </h2>
        {responsibilities.length === 0 ? (
          <p className="hp-empty">{t("print.event.noRoster")}</p>
        ) : (
          <table className="hp-table">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>{t("print.event.roleCol")}</th>
                <th>{t("print.event.membersCol")}</th>
              </tr>
            </thead>
            <tbody>
              {responsibilities.map((resp) => {
                const assignees = resp.assignees || [];
                return (
                  <tr key={resp.id}>
                    <td className="hp-cell-title">
                      {categoryMap.get(resp.categoryId)?.label ||
                        resp.categoryId}
                    </td>
                    <td>
                      {assignees.length === 0 ? (
                        <span className="hp-dim">
                          {t("print.event.noAssignee")}
                        </span>
                      ) : (
                        assignees.map((a) => (
                          <span key={a.id} className="hp-chip">
                            {a.name}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {event.notes && (
        <section className="hp-block hp-note">
          <div className="hp-note-label">{t("print.event.notes")}</div>
          <p>{event.notes}</p>
        </section>
      )}
    </PrintSheet>
  );
};
