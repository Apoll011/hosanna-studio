/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuth } from "@/src/contexts/AuthContext";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useServices } from "@/src/hooks/useServices";
import { useI18n } from "@/src/lib/i18n";
import { AgendaEvent } from "@/src/types";
import { formatLongDate, formatShortDate } from "@/src/utils/agendaDate";
import { Bell, ExternalLink, Link2, Pencil, Send } from "lucide-react";
import React from "react";
import { Button } from "../common";
import { serviceTotalMinutes } from "./ServiceLinkField";

interface DetailsSidebarProps {
  event: AgendaEvent | undefined;
  onEdit: () => void;
  /** Whether the user may send notifications (`notification.sent`). */
  canNotify: boolean;
  /** Users still awaiting an assignment notification (already grouped). */
  unnotifiedCount: number;
  /** Unsent date/location changes tracked for the selected event. */
  pendingDate: boolean;
  pendingLocation: boolean;
  isNotifying: boolean;
  onNotifyAssignments: () => void;
  onNotifyUpdate: () => void;
}
export const DetailsSidebar: React.FC<DetailsSidebarProps> = ({
  event,
  onEdit,
  canNotify,
  unnotifiedCount,
  pendingDate,
  pendingLocation,
  isNotifying,
  onNotifyAssignments,
  onNotifyUpdate,
}) => {
  const { servicesQuery } = useServices();
  const { organization } = useAuth();
  const { navigate } = useAppNavigate();
  const { t, tc } = useI18n();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";

  const linkedService = event?.linkedServiceId
    ? ((servicesQuery.data ?? []).find((s) => s.id === event.linkedServiceId) ??
      null)
    : null;

  if (!event) return null;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-m3-border rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-m3-secondary opacity-70">
            {t("common.details")}
          </h3>
          <button
            onClick={onEdit}
            className="p-1 rounded-lg text-slate-400 hover:text-[#0284c7] hover:bg-m3-hover transition-colors cursor-pointer"
            title={t("agenda.editEvent")}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("common.name")}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
              {event.title}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("common.date")}
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {formatLongDate(event.date, t)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("agenda.time")}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {event.time}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("agenda.duration")}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {t("agenda.minutes", { minutes: event.durationMinutes })}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("agenda.type")}
            </p>
            <p className="text-sm font-bold text-[#0284c7] mt-0.5">
              {event.type}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("agenda.linkedService")}
            </p>
            {linkedService ? (
              <div className="mt-0.5">
                <button
                  onClick={() =>
                    navigate(`${slugPrefix}/services/${linkedService.id}`)
                  }
                  title={t("agenda.openService")}
                  className="flex items-center text-slate-800 justify-between gap-2 rounded-lg hover:text-[#0284c7] hover:text-bold transition-colors cursor-pointer shrink-0"
                >
                  <span className="text-sm font-bold  dark:text-slate-200 truncate min-w-0">
                    {linkedService.name}
                  </span>

                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-[#0284c7] " />
                  {formatShortDate(linkedService.date, t)} ·{" "}
                  {t("agenda.minutes", {
                    minutes: serviceTotalMinutes(linkedService),
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                —
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("agenda.location")}
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {event.location || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {t("agenda.notes")}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              {event.notes || t("agenda.noNotes")}
            </p>
          </div>
        </div>
      </div>

      {canNotify && (
        <div className="bg-white dark:bg-slate-900 border border-m3-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-m3-secondary opacity-70 mb-3 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            {t("agenda.notifications")}
          </h3>

          <div className="space-y-3">
            {/* Assignments — only people not yet notified */}
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {t("agenda.notify.assignSection")}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                {unnotifiedCount > 0
                  ? tc("agenda.notify.pending", unnotifiedCount)
                  : t("agenda.notify.allNotified")}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full mt-2"
                disabled={unnotifiedCount === 0 || isNotifying}
                isLoading={isNotifying}
                onClick={onNotifyAssignments}
                icon={<Bell className="w-3.5 h-3.5" />}
              >
                {t("agenda.notify.assignBtn")}
              </Button>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                {t("agenda.notify.assignHint")}
              </p>
            </div>

            {/* Date / location changes — explicit, aggregated when both */}
            <div className="pt-3 border-t border-m3-border/40">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {t("agenda.notify.updateSection")}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                {pendingDate && pendingLocation
                  ? t("agenda.notify.bothHint")
                  : pendingDate
                    ? t("agenda.notify.datePending")
                    : pendingLocation
                      ? t("agenda.notify.locationPending")
                      : t("agenda.notify.noPendingChanges")}
              </p>
              {(pendingDate || pendingLocation) && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  disabled={isNotifying}
                  isLoading={isNotifying}
                  onClick={onNotifyUpdate}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  {pendingDate && pendingLocation
                    ? t("agenda.notify.bothBtn")
                    : pendingDate
                      ? t("agenda.notify.dateBtn")
                      : t("agenda.notify.locationBtn")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
