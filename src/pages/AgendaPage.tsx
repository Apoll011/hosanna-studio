/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DayAgendaList } from "@/src/components/agenda/DayAgendaList";
import { DetailsSidebar } from "@/src/components/agenda/DetailsSidebar";
import {
  AddResponsibilityModal,
  EditAssigneesModal,
  EditReminderModal,
  EventFormModal,
  EventFormValue,
} from "@/src/components/agenda/EventModals";
import { MiniCalendar, toIso } from "@/src/components/agenda/MiniCalendar";
import { ResponsibilitiesPanel } from "@/src/components/agenda/ResponsibilitiesPanel";
import { useI18n } from "@/src/lib/i18n";
import { AlertTriangle, CalendarPlus, Printer } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/common";
import { Button } from "../components/common/Button";
import { usePrint } from "../contexts/PrintContext";
import { useAgenda } from "../hooks/useAgenda";

export const AgendaPage: React.FC = () => {
  const { t } = useI18n();
  const store = useAgenda();
  const { printEvent, printEvents } = usePrint();
  const [searchParams, setSearchParams] = useSearchParams();

  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toIso(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [isAddResponsibilityOpen, setIsAddResponsibilityOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [editingAssigneesFor, setEditingAssigneesFor] = useState<string | null>(
    null,
  );

  const [isDeleteModalOpen, setIsDeleteModal] = useState<boolean>(false);

  // Open create modal when navigated here with ?create=1 (e.g. from command palette)
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setIsNewEventOpen(true);
      setSearchParams(
        (prev) => {
          prev.delete("create");
          return prev;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const markedDates = useMemo(
    () => new Set(store.events.map((ev) => ev.date)),
    [store.events],
  );

  const eventsForSelectedDate = useMemo(
    () => store.getEventsForDate(selectedDate),
    [store, selectedDate],
  );

  // Keep a valid selection whenever the day or the underlying data changes.
  const effectiveEventId = useMemo(() => {
    if (
      selectedEventId &&
      eventsForSelectedDate.some((ev) => ev.id === selectedEventId)
    ) {
      return selectedEventId;
    }
    return eventsForSelectedDate[0]?.id ?? null;
  }, [selectedEventId, eventsForSelectedDate]);

  const selectedEvent = useMemo(
    () => store.events.find((ev) => ev.id === effectiveEventId),
    [store.events, effectiveEventId],
  );

  const responsibilitiesForSelectedEvent = useMemo(
    () =>
      effectiveEventId
        ? store.getResponsibilitiesForEvent(effectiveEventId)
        : [],
    [store, effectiveEventId],
  );

  const responsibilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of store.events) {
      counts[ev.id] = ev.responsibilities.length;
    }
    return counts;
  }, [store.events]);

  const categoriesById = useMemo(() => {
    const map: Record<string, (typeof store.categories)[number]> = {};
    for (const c of store.categories) map[c.id] = c;
    return map;
  }, [store.categories]);

  // The responsibility being edited, plus the event it lives in (needed to
  // persist assignee changes since responsibilities are embedded in events).
  const editingAssigneesResp = useMemo(() => {
    if (!editingAssigneesFor) return null;
    for (const ev of store.events) {
      const r = ev.responsibilities.find((x) => x.id === editingAssigneesFor);
      if (r) return { eventId: ev.id, responsibility: r };
    }
    return null;
  }, [store.events, editingAssigneesFor]);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedEventId(null);
  };

  const handleCreateEvent = async (value: EventFormValue) => {
    const id = await store.addEvent(value);
    setSelectedDate(value.date);
    setSelectedEventId(id);
    setIsNewEventOpen(false);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-m3-bg dark:bg-m3-bg">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {t("common.agenda")}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              {t("agenda.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedEvent ? (
              <button
                onClick={() => {
                  printEvent(selectedEvent, store.categories);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors cursor-pointer"
                title={t("print.buttons.printEventTitle")}
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span className="hidden sm:inline">
                  {t("print.buttons.printEvent")}
                </span>
              </button>
            ) : eventsForSelectedDate.length > 0 ? (
              <button
                onClick={() => {
                  printEvents(
                    eventsForSelectedDate,
                    store.categories,
                    `Agenda de ${selectedDate}`,
                  );
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors cursor-pointer"
                title={t("print.buttons.printDayTitle")}
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span className="hidden sm:inline">
                  {t("print.buttons.printDay", {
                    count: eventsForSelectedDate.length,
                  })}
                </span>
              </button>
            ) : null}

            {selectedEvent && (
              <button
                onClick={() => {
                  setIsDeleteModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-sm transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4" />
                {t("agenda.deleteEvent")}
              </button>
            )}

            <button
              onClick={() => setIsNewEventOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-500 text-white hover:bg-sky-600 shadow-sm transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              {t("agenda.newEvent")}
            </button>
          </div>
        </div>

        {/* Body: calendar / events / details */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-5 items-start">
          <div className="space-y-4">
            <MiniCalendar
              visibleMonth={visibleMonth}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelectDate={handleSelectDate}
              onChangeMonth={(delta) =>
                setVisibleMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
                )
              }
              onGoToday={() => {
                const iso = toIso(new Date());
                setVisibleMonth(new Date());
                handleSelectDate(iso);
              }}
            />
            <DayAgendaList
              events={eventsForSelectedDate}
              selectedEventId={effectiveEventId}
              responsibilityCounts={responsibilityCounts}
              onSelectEvent={setSelectedEventId}
            />
          </div>

          <ResponsibilitiesPanel
            event={selectedEvent}
            responsibilities={responsibilitiesForSelectedEvent}
            categories={categoriesById}
            onAddResponsibility={() => setIsAddResponsibilityOpen(true)}
            onEditAssignees={(respId) => setEditingAssigneesFor(respId)}
            onRemoveResponsibility={(respId) => {
              if (selectedEvent) {
                store.removeResponsibility(selectedEvent.id, respId);
              }
            }}
          />

          <DetailsSidebar
            event={selectedEvent}
            onEdit={() => setIsEditEventOpen(true)}
            onToggleReminder={() => {
              if (!selectedEvent) return;
              store.updateReminder(selectedEvent.id, {
                ...selectedEvent.reminder,
                enabled: !selectedEvent.reminder.enabled,
              });
            }}
            onEditReminder={() => setIsReminderOpen(true)}
          />
        </div>
      </div>

      {/* Create event */}
      <EventFormModal
        isOpen={isNewEventOpen}
        onClose={() => setIsNewEventOpen(false)}
        onSubmit={handleCreateEvent}
        title={t("agenda.newEvent")}
        submitLabel={t("agenda.createEvent")}
        initial={{ date: selectedDate }}
      />

      {/* Edit event (title / type / date-time / duration / linked service /
          location / notes) */}
      {selectedEvent && (
        <EventFormModal
          isOpen={isEditEventOpen}
          onClose={() => setIsEditEventOpen(false)}
          onSubmit={(value) => {
            store.updateEvent(selectedEvent.id, value);
            setSelectedDate(value.date);
            setIsEditEventOpen(false);
          }}
          onDelete={() => {
            store.deleteEvent(selectedEvent.id);
            setSelectedEventId(null);
            setIsEditEventOpen(false);
          }}
          title={t("agenda.editEvent")}
          submitLabel={t("common.save")}
          initial={selectedEvent as EventFormValue}
        />
      )}

      {/* Add responsibility */}
      {selectedEvent && (
        <AddResponsibilityModal
          isOpen={isAddResponsibilityOpen}
          onClose={() => setIsAddResponsibilityOpen(false)}
          categories={store.categories}
          existingCategoryIds={responsibilitiesForSelectedEvent.map(
            (r) => r.categoryId,
          )}
          manualSuggestions={store.manualAssignees}
          onSubmit={async (categoryId, assignees) => {
            try {
              // Await the save so a failure keeps the modal open (the hook
              // shows the error toast) instead of closing it silently.
              await store.addResponsibility(
                selectedEvent.id,
                categoryId,
                assignees,
              );
              setIsAddResponsibilityOpen(false);
            } catch {
              // error toast already shown by the hook; keep the modal open
            }
          }}
        />
      )}

      {/* Edit assignees of one responsibility */}
      {editingAssigneesResp && (
        <EditAssigneesModal
          isOpen={!!editingAssigneesFor}
          onClose={() => setEditingAssigneesFor(null)}
          categoryLabel={
            categoriesById[editingAssigneesResp.responsibility.categoryId]
              ?.label ?? ""
          }
          assignees={editingAssigneesResp.responsibility.assignees}
          manualSuggestions={store.manualAssignees}
          onSubmit={async (assignees) => {
            try {
              // Await the save so a failure keeps the modal open.
              await store.updateResponsibilityAssignees(
                editingAssigneesResp.eventId,
                editingAssigneesResp.responsibility.id,
                assignees,
              );
              setEditingAssigneesFor(null);
            } catch {
              // error toast already shown by the hook; keep the modal open
            }
          }}
        />
      )}

      {/* Edit reminder */}
      {selectedEvent && (
        <EditReminderModal
          isOpen={isReminderOpen}
          onClose={() => setIsReminderOpen(false)}
          initialLabel={selectedEvent.reminder.label}
          onSubmit={(label) => {
            store.updateReminder(selectedEvent.id, {
              ...selectedEvent.reminder,
              label,
              enabled: true,
            });
            setIsReminderOpen(false);
          }}
        />
      )}

      {selectedEvent && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModal(false)}
          title={t("agenda.deleteEventConfirm")}
        >
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{t("agenda.deleteEventConfirm")}</span>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setIsDeleteModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  store.deleteEvent(selectedEvent.id);
                  setSelectedEventId(null);
                  setIsDeleteModal(false);
                }}
              >
                {t("agenda.deleteEvent")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AgendaPage;
