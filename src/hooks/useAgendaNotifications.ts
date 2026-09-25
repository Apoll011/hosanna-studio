/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Studio-side notification flows for agenda events.
 *
 * The Studio already owns every relevant fact (service, responsibilities,
 * people, date, location), so it decides WHEN and WHO — and sends the fully
 * resolved payload to the API, which only validates and delivers through FCM:
 *
 *   Studio → POST /notifications (per recipient) → FCM → mobile app
 *
 * Time-based reminders (3 days / 1 day before) stay server-side cron and are
 * deliberately NOT handled here.
 */

import {
  notificationsApi,
  type NotificationType,
  type SendNotificationsResult,
} from "@/src/api";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSync } from "@/src/contexts/SyncContext";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import type { AgendaEvent, ResponsibilityCategory } from "@/src/types";
import { formatLongDate } from "@/src/utils/agendaDate";
import {
  bulletList,
  collectEventMembers,
  collectUnnotifiedAssignments,
  markMembersNotified,
  type AssignmentGroup,
} from "@/src/utils/agendaNotify";
import { useCallback, useMemo, useState } from "react";
import type { UseAgendaReturn } from "./useAgenda";

/** Unsent event edits, tracked per event id for the current session. */
export type PendingUpdateChanges = {
  date?: boolean;
  location?: boolean;
};

type DeliverOptions = {
  type: NotificationType;
  targetEvent: AgendaEvent;
  /** One notification per entry — never one per responsibility. */
  groups: AssignmentGroup[];
  title: string;
  buildBody: (labels: string[]) => string;
  buildData?: (labels: string[]) => Record<string, string>;
};

type DeliverOutcome = {
  result: SendNotificationsResult;
  succeededMemberIds: string[];
};

export function useAgendaNotifications(options: {
  event: AgendaEvent | undefined;
  store: UseAgendaReturn;
  categoriesById: Record<string, ResponsibilityCategory>;
}) {
  const { event, store, categoriesById } = options;
  const { organization } = useAuth();
  const { showToast } = useSync();
  const { t, tc } = useI18n();
  const { granted: canNotify } = useCan("notification.sent");

  const [changed, setChanged] = useState<Record<string, PendingUpdateChanges>>(
    {},
  );
  const [isNotifying, setIsNotifying] = useState(false);

  /** memberId (org member record id) → userId, required to address a push. */
  const userIdByMemberId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of organization?.members ?? []) {
      map.set(member.id, member.userId);
    }
    return map;
  }, [organization]);

  const isReachable = useCallback(
    (memberId: string) => userIdByMemberId.has(memberId),
    [userIdByMemberId],
  );

  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";
  const agendaHref = `${slugPrefix}/agenda`;

  /* ── Pending state ───────────────────────────────────────────────────── */

  const pendingAssignments = useMemo(
    () =>
      event
        ? collectUnnotifiedAssignments(
            event,
            categoriesById,
            t("agenda.responsibility"),
            isReachable,
          )
        : [],
    [event, categoriesById, t, isReachable],
  );

  const unnotifiedCount = pendingAssignments.length;
  const pendingDate = !!event && changed[event.id]?.date === true;
  const pendingLocation = !!event && changed[event.id]?.location === true;

  /** Record a saved edit so the explicit "notify" action can pick it up. */
  const markChanged = useCallback(
    (eventId: string, fields: PendingUpdateChanges) => {
      setChanged((prev) => ({
        ...prev,
        [eventId]: { ...prev[eventId], ...fields },
      }));
    },
    [],
  );

  const clearChanged = useCallback((eventId: string) => {
    setChanged((prev) => {
      if (!prev[eventId]) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  /* ── Sending ─────────────────────────────────────────────────────────── */

  const formatEventDate = useCallback(
    (target: AgendaEvent) =>
      `${formatLongDate(target.date, t)} ${t("agenda.notify.atTime", {
        time: target.time,
      })}`,
    [t],
  );

  /**
   * One API request per recipient. Returns `null` when nobody is reachable so
   * callers can give feedback WITHOUT hitting the API.
   */
  const deliver = useCallback(
    async (opts: DeliverOptions): Promise<DeliverOutcome | null> => {
      const memberByUserId = new Map<string, string>();
      const recipients = [];

      for (const group of opts.groups) {
        const userId = userIdByMemberId.get(group.memberId);
        if (!userId) continue;
        memberByUserId.set(userId, group.memberId);
        recipients.push({
          userId,
          description: opts.buildBody(group.labels),
          ...(opts.buildData ? { data: opts.buildData(group.labels) } : {}),
        });
      }

      if (recipients.length === 0) return null;

      const result = await notificationsApi.send({
        type: opts.type,
        recipients,
        title: opts.title,
        href: agendaHref,
        data: {
          eventId: opts.targetEvent.id,
          date: opts.targetEvent.date,
          title: opts.targetEvent.title,
        },
      });

      return {
        result,
        succeededMemberIds: result.succeededUserIds
          .map((userId) => memberByUserId.get(userId))
          .filter((memberId): memberId is string => !!memberId),
      };
    },
    [userIdByMemberId, agendaHref],
  );

  const report = useCallback(
    (result: SendNotificationsResult) => {
      if (result.sent === 0) {
        showToast(
          t("agenda.notify.sendError", {
            error: result.failed[0]?.error || "",
          }),
          "error",
        );
      } else if (result.failed.length === 0) {
        showToast(tc("agenda.notify.sentCount", result.sent), "success");
      } else {
        showToast(
          t("agenda.notify.sentPartial", {
            sent: result.sent,
            failed: result.failed.length,
          }),
          "warning",
        );
      }
    },
    [showToast, t, tc],
  );

  /* ── 1. Assignments (only entries with notified !== true) ────────────── */

  const notifyAssignments = useCallback(async () => {
    if (!event || isNotifying) return;
    if (!canNotify) {
      showToast(t("agenda.notify.noPermission"), "error");
      return;
    }
    // No recipients → feedback only, no unnecessary API request.
    if (pendingAssignments.length === 0) {
      showToast(t("agenda.notify.noRecipients"), "info");
      return;
    }

    setIsNotifying(true);
    try {
      const outcome = await deliver({
        type: "assignment_created",
        targetEvent: event,
        groups: pendingAssignments,
        title: t("agenda.notify.assignmentTitle", { event: event.title }),
        buildBody: (labels) =>
          t("agenda.notify.assignmentBody", {
            date: formatEventDate(event),
            list: bulletList(labels),
          }),
        buildData: (labels) => ({ responsibilities: bulletList(labels) }),
      });

      if (!outcome) {
        showToast(t("agenda.notify.noRecipients"), "info");
        return;
      }

      report(outcome.result);

      // Flip ONLY what the API actually accepted — a failed delivery leaves
      // the entries pending so the next press retries them.
      if (outcome.succeededMemberIds.length > 0) {
        await store.setResponsibilities(
          event.id,
          markMembersNotified(
            event.responsibilities,
            outcome.succeededMemberIds,
          ),
        );
      }
    } catch (err) {
      showToast(
        t("agenda.notify.sendError", {
          error: (err as Error).message || "",
        }),
        "error",
      );
    } finally {
      setIsNotifying(false);
    }
  }, [
    event,
    isNotifying,
    canNotify,
    pendingAssignments,
    deliver,
    formatEventDate,
    report,
    store,
    showToast,
    t,
  ]);

  /* ── 2. Date / location changes (explicit, aggregated when both) ─────── */

  const notifyUpdate = useCallback(async () => {
    if (!event || isNotifying) return;
    if (!canNotify) {
      showToast(t("agenda.notify.noPermission"), "error");
      return;
    }

    const flags = changed[event.id] ?? {};
    if (!flags.date && !flags.location) return;

    const memberIds = collectEventMembers(event, isReachable);
    if (memberIds.length === 0) {
      showToast(t("agenda.notify.noRecipients"), "info");
      return;
    }

    const both = !!flags.date && !!flags.location;
    const type: NotificationType = both
      ? "service_updated"
      : flags.date
        ? "service_date_changed"
        : "service_location_changed";

    const dateText = formatEventDate(event);
    const locationText = event.location?.trim() || "—";
    const title = both
      ? t("agenda.notify.updateTitle", { event: event.title })
      : flags.date
        ? t("agenda.notify.dateTitle", { event: event.title })
        : t("agenda.notify.locationTitle", { event: event.title });
    const body = both
      ? t("agenda.notify.updateBody", {
          date: dateText,
          location: locationText,
        })
      : flags.date
        ? t("agenda.notify.dateBody", { date: dateText })
        : t("agenda.notify.locationBody", { location: locationText });

    setIsNotifying(true);
    try {
      const outcome = await deliver({
        type,
        targetEvent: event,
        // One push per user — responsibilities never multiply the count.
        groups: memberIds.map((memberId) => ({ memberId, labels: [] })),
        title,
        buildBody: () => body,
      });

      if (!outcome) {
        showToast(t("agenda.notify.noRecipients"), "info");
        return;
      }

      report(outcome.result);

      // Everything went out → the change is now communicated.
      if (outcome.result.sent > 0 && outcome.result.failed.length === 0) {
        clearChanged(event.id);
      }
    } catch (err) {
      showToast(
        t("agenda.notify.sendError", {
          error: (err as Error).message || "",
        }),
        "error",
      );
    } finally {
      setIsNotifying(false);
    }
  }, [
    event,
    isNotifying,
    canNotify,
    changed,
    isReachable,
    deliver,
    formatEventDate,
    clearChanged,
    report,
    showToast,
    t,
  ]);

  /* ── 3. Removal cancellation (explicit toggle in the delete flow) ────── */

  const notifyRemoval = useCallback(
    async (groups: AssignmentGroup[]): Promise<boolean> => {
      if (!event || isNotifying) return false;
      if (!canNotify) {
        showToast(t("agenda.notify.noPermission"), "error");
        return false;
      }
      if (groups.length === 0) {
        showToast(t("agenda.notify.noRecipients"), "info");
        return false;
      }

      setIsNotifying(true);
      try {
        const outcome = await deliver({
          type: "assignment_removed",
          targetEvent: event,
          groups,
          title: t("agenda.notify.removalTitle", { event: event.title }),
          buildBody: (labels) =>
            t("agenda.notify.removalBody", {
              date: formatEventDate(event),
              list: bulletList(labels),
            }),
          buildData: (labels) => ({ removed: bulletList(labels) }),
        });

        if (!outcome) {
          showToast(t("agenda.notify.noRecipients"), "info");
          return false;
        }

        report(outcome.result);
        return outcome.result.sent > 0;
      } catch (err) {
        showToast(
          t("agenda.notify.sendError", {
            error: (err as Error).message || "",
          }),
          "error",
        );
        return false;
      } finally {
        setIsNotifying(false);
      }
    },
    [
      event,
      isNotifying,
      canNotify,
      deliver,
      formatEventDate,
      report,
      showToast,
      t,
    ],
  );

  return {
    canNotify,
    isNotifying,
    unnotifiedCount,
    pendingDate,
    pendingLocation,
    markChanged,
    clearChanged,
    notifyAssignments,
    notifyUpdate,
    notifyRemoval,
  };
}

export type UseAgendaNotificationsReturn = ReturnType<
  typeof useAgendaNotifications
>;
