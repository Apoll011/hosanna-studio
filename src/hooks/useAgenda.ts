/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import {
  AgendaEvent,
  Assignee,
  ReminderSettings,
  Responsibility,
} from "@/src/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSync } from "../contexts/SyncContext";
import {
  AgendaEventDocType,
  getDatabase,
  getPurgeAt,
  validateAgendaEventRules,
} from "../db";
import { useOrgSettings } from "./useOrgSettings";

const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  label: "1 dia antes às 18:00",
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const byDateThenTime = (a: AgendaEvent, b: AgendaEvent) =>
  a.date === b.date
    ? a.time.localeCompare(b.time)
    : a.date.localeCompare(b.date);

let cachedEvents: AgendaEvent[] | null = null;

/**
 * Everything the Agenda UI needs to read/write its data.
 *
 * Backed by the RxDB `agendaEvents` collection (see `src/db/schemas.ts`),
 * which replicates with the server through the same HTTP pull/push protocol
 * as songs/folders/services — the old localStorage mock is gone.
 *
 * Responsibilities are embedded in their event, and the responsibility
 * categories are org-wide: they live in the org metadata (Settings → General
 * → Responsabilidades), read here from `useOrgSettings` and never persisted
 * by this hook.
 */
export function useAgenda() {
  const { organization } = useAuth();
  const { settings, savedSettings } = useOrgSettings();
  const { showToast } = useSync();
  const { t } = useI18n();

  const [events, setEvents] = useState<AgendaEvent[]>(() => {
    if (cachedEvents) return [...cachedEvents].sort(byDateThenTime);
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => cachedEvents === null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Live subscription: non-trashed events, ordered by date then time.
  useEffect(() => {
    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeEvents() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSub = db.agendaEvents
          .find({
            selector: {
              isDeleted: {
                $ne: true,
              },
            },
          })
          .$.subscribe((docs) => {
            if (!isSubscribed) return;
            const data = docs
              .map((d) => d.toJSON() as AgendaEvent)
              .sort(byDateThenTime);
            cachedEvents = data;
            setEvents(data);
            setIsLoading(false);
          });
      } catch (err) {
        console.error("Failed to query agenda events from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeEvents();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, []);

  const categories = settings.agenda.responsibilityCategories;

  const getEventsForDate = useCallback(
    (date: string) => events.filter((ev) => ev.date === date),
    [events],
  );

  const getResponsibilitiesForEvent = useCallback(
    (eventId: string) =>
      events.find((ev) => ev.id === eventId)?.responsibilities ?? [],
    [events],
  );

  const upcomingEventCount = useMemo(
    () =>
      events.filter((event) => {
        const eventDate = new Date(`${event.date}T${event.time}`);
        return eventDate >= now;
      }).length,
    [events, now],
  );

  /**
   * Manually-typed assignees (no `memberId`) used anywhere across all events,
   * deduped by name. Suggested by the assignee picker so users don't have to
   * retype a name for every event. Member-linked assignees are excluded here —
   * they're suggested from the org member list instead.
   */
  const manualAssignees = useMemo(() => {
    const seen = new Set<string>();
    const out: Assignee[] = [];
    for (const ev of events) {
      for (const r of ev.responsibilities) {
        for (const a of r.assignees) {
          if (a.memberId) continue;
          const key = a.name.trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push(a);
        }
      }
    }
    return out;
  }, [events]);

  // Categories that are actually persisted in the org metadata. The Agenda's
  // own instance of useOrgSettings never mutates, so this equals `settings`
  // here — but using the persisted set keeps the cleanup honest even if a
  // draft were ever introduced.
  const persistedCategoryIds = useMemo(
    () =>
      new Set(savedSettings.agenda.responsibilityCategories.map((c) => c.id)),
    [savedSettings.agenda.responsibilityCategories],
  );

  /**
   * Scrub responsibilities whose category no longer exists in the org
   * metadata (e.g. it was deleted in Settings → General → Responsabilidades).
   * Runs on mount and whenever the persisted categories change, so it also
   * catches deletes that happened while the Agenda page was closed. Skips
   * until the org is loaded to avoid reacting to the default pre-load state.
   */
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;

    void (async () => {
      try {
        const db = await getDatabase();
        if (cancelled) return;

        const live = await db.agendaEvents
          .find({
            selector: { isDeleted: { $ne: true } },
          })
          .exec();

        const now = new Date().toISOString();
        for (const doc of live) {
          const kept = doc.responsibilities.filter((r) =>
            persistedCategoryIds.has(r.categoryId),
          );
          if (kept.length !== doc.responsibilities.length) {
            await doc.patch({
              responsibilities: kept,
              updatedAt: now,
            });
          }
        }
      } catch (err) {
        console.error("Failed to scrub agenda responsibilities", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organization, persistedCategoryIds]);

  const addEvent = useCallback(
    async (
      input: Omit<AgendaEvent, "id" | "reminder" | "responsibilities"> & {
        reminder?: ReminderSettings;
      },
    ): Promise<string> => {
      setIsCreating(true);
      try {
        validateAgendaEventRules(input);
        const db = await getDatabase();
        const now = new Date().toISOString();
        const event: AgendaEventDocType = {
          id: newId("evt"),
          date: input.date,
          title: input.title.trim(),
          type: input.type,
          time: input.time,
          durationMinutes: input.durationMinutes,
          location: input.location ?? null,
          notes: input.notes ?? null,
          reminder: input.reminder ?? DEFAULT_REMINDER,
          linkedServiceId: input.linkedServiceId ?? null,
          responsibilities: [],
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          purgeAt: null,
          _deleted: false,
        };

        await db.agendaEvents.insert(event);
        showToast(t("hooks.agenda.created"), "success");
        return event.id;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(msg || t("hooks.agenda.saveError", { error: "" }), "error");
        }
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast, t],
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<AgendaEvent>): Promise<void> => {
      setIsUpdating(true);
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(id).exec();
        if (!doc) {
          showToast(
            t("hooks.agenda.saveError", { error: "Event not found" }),
            "error",
          );
          throw new Error("Event not found");
        }

        // Validate the merged state so partial patches (e.g. reminder-only)
        // still satisfy the required-field rules.
        validateAgendaEventRules({
          title: patch.title ?? doc.title,
          date: patch.date ?? doc.date,
          type: patch.type ?? doc.type,
          time: patch.time ?? doc.time,
          durationMinutes: patch.durationMinutes ?? doc.durationMinutes,
        });

        const now = new Date().toISOString();
        const next: Partial<AgendaEventDocType> = {
          updatedAt: now,
          _deleted: false,
        };
        if (patch.title !== undefined) next.title = patch.title;
        if (patch.date !== undefined) next.date = patch.date;
        if (patch.type !== undefined) next.type = patch.type;
        if (patch.time !== undefined) next.time = patch.time;
        if (patch.durationMinutes !== undefined)
          next.durationMinutes = patch.durationMinutes;
        if (patch.location !== undefined)
          next.location = patch.location ?? null;
        if (patch.notes !== undefined) next.notes = patch.notes ?? null;
        if (patch.linkedServiceId !== undefined)
          next.linkedServiceId = patch.linkedServiceId ?? null;
        if (patch.reminder !== undefined) next.reminder = patch.reminder;
        if (patch.responsibilities !== undefined)
          next.responsibilities = patch.responsibilities;

        await doc.patch(next);
        showToast(t("hooks.agenda.updated"), "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          const msg = (err as Error).message;
          showToast(msg || t("hooks.agenda.saveError", { error: "" }), "error");
        }
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, t],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<void> => {
      setIsDeleting(true);
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(id).exec();
        if (doc) {
          // Move to trash; permanent removal happens at purgeAt server-side.
          await doc.patch({
            isDeleted: true,
            purgeAt: getPurgeAt(),
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("hooks.agenda.deleted"), "info");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.agenda.deleteError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [showToast, t],
  );

  const restoreEvent = useCallback(
    async (id: string): Promise<void> => {
      setIsRestoring(true);
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(id).exec();
        if (doc) {
          await doc.patch({
            isDeleted: false,
            purgeAt: null,
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("hooks.agenda.restored"), "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.agenda.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsRestoring(false);
      }
    },
    [showToast, t],
  );

  const updateReminder = useCallback(
    (eventId: string, reminder: ReminderSettings) =>
      updateEvent(eventId, { reminder }),
    [updateEvent],
  );

  const addResponsibility = useCallback(
    async (
      eventId: string,
      categoryId: string,
      assignees: Assignee[] = [],
    ): Promise<string> => {
      const id = newId("resp");
      const responsibility: Responsibility = { id, categoryId, assignees };
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(eventId).exec();
        if (!doc) throw new Error("Event not found");
        await doc.patch({
          responsibilities: [...doc.responsibilities, responsibility],
          updatedAt: new Date().toISOString(),
        });
        return id;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.agenda.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      }
    },
    [showToast, t],
  );

  const updateResponsibilityAssignees = useCallback(
    async (
      eventId: string,
      respId: string,
      assignees: Assignee[],
    ): Promise<void> => {
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(eventId).exec();
        if (!doc) return;
        await doc.patch({
          responsibilities: doc.responsibilities.map((r) =>
            r.id === respId ? { ...r, assignees } : r,
          ),
          updatedAt: new Date().toISOString(),
        });
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.agenda.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      }
    },
    [showToast, t],
  );

  const removeResponsibility = useCallback(
    async (eventId: string, respId: string): Promise<void> => {
      try {
        const db = await getDatabase();
        const doc = await db.agendaEvents.findOne(eventId).exec();
        if (!doc) return;
        await doc.patch({
          responsibilities: doc.responsibilities.filter((r) => r.id !== respId),
          updatedAt: new Date().toISOString(),
        });
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.agenda.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      }
    },
    [showToast, t],
  );

  return {
    events,
    upcomingEventCount,
    isLoading,
    categories,
    manualAssignees,
    getEventsForDate,
    getResponsibilitiesForEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    restoreEvent,
    updateReminder,
    addResponsibility,
    updateResponsibilityAssignees,
    removeResponsibility,
    isCreating,
    isUpdating,
    isDeleting,
    isRestoring,
  };
}

export type UseAgendaReturn = ReturnType<typeof useAgenda>;
