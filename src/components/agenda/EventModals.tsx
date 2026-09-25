/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useServices } from "@/src/hooks/useServices";
import { TranslateFn, useI18n } from "@/src/lib/i18n";
import { Assignee, ResponsibilityCategory } from "@/src/types";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Clock3,
  FileText,
  Inbox,
  Info,
  Layers,
  ListChecks,
  MapPin,
  Minus,
  Plus,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { AssigneeTagInput } from "./AssigneeTagInput";
import { ServiceLinkField } from "./ServiceLinkField";

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

/** Section header with an icon "badge", a title and an optional hint. */
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
}> = ({ icon, title, hint }) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 w-6 h-6 shrink-0 rounded-lg bg-[#0284c7]/10 text-[#0284c7] flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-[13px] font-bold text-m3-text/80 leading-tight">
        {title}
      </p>
      {hint && (
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
          {hint}
        </p>
      )}
    </div>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-bold text-m3-text/60 uppercase tracking-wider ml-1 mb-1.5">
    {children}
  </label>
);

const fieldInputClass =
  "w-full h-11 pl-10 pr-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0284c7] transition-colors";

/** Small icon-only round button, used for steppers and dismiss actions. */
const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "danger";
  }
> = ({ className = "", variant = "default", ...props }) => (
  <button
    type="button"
    className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
      variant === "danger"
        ? "border-red-200 dark:border-red-900/60 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-[#0284c7]/50 hover:text-[#0284c7]"
    } ${className}`}
    {...props}
  />
);

const formatDuration = (minutes: number, t: TranslateFn) => {
  if (minutes <= 0) return t("agenda.durationZero");
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return t("agenda.durationHoursMinutes", { hours: h, minutes: m });
  if (h) return t("agenda.durationHours", { hours: h });
  return t("agenda.minutes", { minutes: m });
};

/* ------------------------------------------------------------------ */
/* Create / edit an event                                             */
/* ------------------------------------------------------------------ */

export interface EventFormValue {
  title: string;
  type: string;
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  notes: string;
  /** Linked order-of-worship `Service.id` (`@/src/types`), or null. */
  linkedServiceId: string | null;
}

const DURATION_PRESETS = [30, 45, 60, 90, 120];
const NOTES_MAX = 500;

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: EventFormValue) => void;
  onDelete?: () => void;
  initial?: Partial<EventFormValue>;
  title: string;
  submitLabel: string;
}

const emptyEventForm = (
  initial: Partial<EventFormValue> | undefined,
  defaultType: string,
): EventFormValue => ({
  title: initial?.title ?? "",
  type: initial?.type ?? defaultType,
  date: initial?.date ?? new Date().toISOString().slice(0, 10),
  time: initial?.time ?? "10:00",
  durationMinutes: initial?.durationMinutes ?? 90,
  location: initial?.location ?? "",
  notes: initial?.notes ?? "",
  linkedServiceId: initial?.linkedServiceId ?? null,
});

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initial,
  title,
  submitLabel,
}) => {
  const { t } = useI18n();
  const { servicesQuery } = useServices();
  const services = servicesQuery.data ?? [];
  const servicesLoading = servicesQuery.isLoading;

  const eventTypeOptions = [
    t("agenda.eventTypes.sundayService"),
    t("agenda.eventTypes.prayerService"),
    t("agenda.eventTypes.worshipRehearsal"),
    t("agenda.eventTypes.bibleStudy"),
    t("agenda.eventTypes.teamMeeting"),
    t("agenda.eventTypes.specialEvent"),
  ];
  const defaultType = eventTypeOptions[0] ?? "";

  const [form, setForm] = useState<EventFormValue>(() =>
    emptyEventForm(initial, defaultType),
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(emptyEventForm(initial, defaultType));
      setTitleTouched(false);
      setConfirmingDelete(false);
    }
  }, [isOpen]);

  const titleIsEmpty = form.title.trim().length === 0;
  const showTitleError = titleTouched && titleIsEmpty;

  /**
   * Linking a service pulls its info into the event: the date comes from the
   * service's date and the duration from the sum of its elements. The title
   * is only pre-filled when empty (so the user's own title wins).
   */
  const handleSelectService = (serviceId: string | null) => {
    if (!serviceId) {
      setForm((f) => ({ ...f, linkedServiceId: null }));
      return;
    }
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    const seconds = (service.elements ?? []).reduce(
      (acc, el) => acc + Math.max(0, Number(el.duration || 0)),
      0,
    );
    setForm((f) => ({
      ...f,
      linkedServiceId: serviceId,
      date: service.date.slice(0, 10) || f.date,
      durationMinutes:
        seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : f.durationMinutes,
      title: f.title.trim() ? f.title : service.name,
    }));
  };

  const adjustDuration = (delta: number) =>
    setForm((f) => ({
      ...f,
      durationMinutes: Math.max(0, f.durationMinutes + delta),
    }));

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTitleTouched(true);
          if (titleIsEmpty) return;
          onSubmit(form);
        }}
        className="space-y-7 pt-1"
      >
        {/* ── Serviço ligado ─────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <SectionHeader
            icon={<Layers className="w-3.5 h-3.5" />}
            title={t("agenda.linkedService")}
            hint={t("agenda.linkedServiceHint")}
          />
          <ServiceLinkField
            services={services}
            isLoading={servicesLoading}
            value={form.linkedServiceId}
            onChange={handleSelectService}
          />
        </section>

        {/* ── Informações ────────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <SectionHeader
            icon={<FileText className="w-3.5 h-3.5" />}
            title={t("agenda.information")}
          />
          <div>
            <Input
              label={t("agenda.eventTitle")}
              placeholder={t("agenda.eventTitlePlaceholder")}
              icon={<FileText className="w-4 h-4" />}
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                if (titleTouched) setTitleTouched(false);
              }}
              onBlur={() => setTitleTouched(true)}
              required
            />
            {showTitleError && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500 mt-1.5 ml-1">
                <Info className="w-3 h-3" /> {t("agenda.eventTitleRequired")}
              </p>
            )}
          </div>
          <div>
            <FieldLabel>{t("agenda.type")}</FieldLabel>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                list="agenda-event-types"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                placeholder={t("agenda.typePlaceholder")}
                className={fieldInputClass}
              />
            </div>
            <datalist id="agenda-event-types">
              {eventTypeOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {eventTypeOptions
                .filter((opt) => opt !== form.type)
                .map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: opt }))}
                    className="px-2.5 h-7 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-[#0284c7]/50 hover:text-[#0284c7] transition-colors cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
            </div>
          </div>
        </section>

        {/* ── Agendamento ────────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <SectionHeader
            icon={<Calendar className="w-3.5 h-3.5" />}
            title={t("agenda.scheduling")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label={t("common.date")}
              icon={<Calendar className="w-4 h-4" />}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            <Input
              type="time"
              label={t("agenda.time")}
              icon={<Clock className="w-4 h-4" />}
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              required
            />
          </div>
          <div>
            <FieldLabel>{t("agenda.duration")}</FieldLabel>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, durationMinutes: m }))}
                  className={`px-3 h-8 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                    form.durationMinutes === m
                      ? "bg-[#0284c7] text-white border-[#0284c7]"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#0284c7]/40"
                  }`}
                >
                  {t("agenda.minutes", { minutes: m })}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                aria-label={t("agenda.decreaseDuration")}
                onClick={() => adjustDuration(-15)}
                disabled={form.durationMinutes <= 0}
              >
                <Minus className="w-4 h-4" />
              </IconButton>
              <div className="flex-1 h-11 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <Clock3 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold tabular-nums">
                  {formatDuration(form.durationMinutes, t)}
                </span>
              </div>
              <IconButton
                aria-label={t("agenda.increaseDuration")}
                onClick={() => adjustDuration(15)}
              >
                <Plus className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        </section>

        {/* ── Detalhes ───────────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <SectionHeader
            icon={<MapPin className="w-3.5 h-3.5" />}
            title={t("common.details")}
          />
          <Input
            label={t("agenda.location")}
            placeholder={t("agenda.locationPlaceholder")}
            icon={<MapPin className="w-4 h-4" />}
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
          <div>
            <div className="flex items-center justify-between ml-1 mb-1.5">
              <FieldLabel>
                <span className="ml-0">{t("agenda.notes")}</span>
              </FieldLabel>
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  form.notes.length > NOTES_MAX
                    ? "text-red-500"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              >
                {form.notes.length}/{NOTES_MAX}
              </span>
            </div>
            <textarea
              value={form.notes}
              maxLength={NOTES_MAX}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder={t("agenda.notesPlaceholder")}
              className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0284c7] transition-colors resize-none"
            />
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-m3-border/40">
          {onDelete ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-red-500 hidden sm:inline">
                  {t("agenda.deleteEventConfirm")}
                </span>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t("common.cancel")}
                </Button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="h-10 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("common.confirm")}
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                type="button"
                onClick={() => setConfirmingDelete(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                {t("agenda.deleteEvent")}
              </Button>
            )
          ) : (
            <span />
          )}
          {!confirmingDelete && (
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" type="submit">
                {submitLabel}
              </Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Add a responsibility (pick category + assignees) to an event       */
/* ------------------------------------------------------------------ */

interface AddResponsibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ResponsibilityCategory[];
  existingCategoryIds: string[];
  manualSuggestions?: Assignee[];
  onSubmit: (categoryId: string, assignees: Assignee[]) => void;
}

export const AddResponsibilityModal: React.FC<AddResponsibilityModalProps> = ({
  isOpen,
  onClose,
  categories,
  existingCategoryIds,
  manualSuggestions,
  onSubmit,
}) => {
  const { t, tc } = useI18n();
  const available = useMemo(
    () => categories.filter((c) => !existingCategoryIds.includes(c.id)),
    [categories, existingCategoryIds],
  );
  const [categoryId, setCategoryId] = useState(available[0]?.id ?? "");
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCategoryId(available[0]?.id ?? "");
      setAssignees([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("agenda.addResponsibility")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!categoryId) return;
          onSubmit(categoryId, assignees);
        }}
        className="space-y-5 pt-2"
      >
        {available.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2.5 py-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {t("agenda.allResponsibilitiesAdded")}
            </p>
            <p className="text-xs font-medium text-slate-400 max-w-60 leading-relaxed">
              {t("agenda.createCategoriesInSettings")}
            </p>
          </div>
        ) : (
          <>
            <section className="space-y-2.5">
              <SectionHeader
                icon={<ListChecks className="w-3.5 h-3.5" />}
                title={t("agenda.category")}
                hint={t("agenda.categoryHint")}
              />
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {available.map((c) => {
                  const selected = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={`flex items-center justify-between gap-3 px-3.5 h-11 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                        selected
                          ? "border-[#0284c7] bg-[#0284c7]/6 text-[#0284c7]"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#0284c7]/40"
                      }`}
                    >
                      <span>{c.label}</span>
                      {selected ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0 text-slate-200 dark:text-slate-700" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2.5">
              <SectionHeader
                icon={<Users className="w-3.5 h-3.5" />}
                title={t("agenda.assignTo")}
                hint={
                  assignees.length > 0
                    ? tc("agenda.selectedAssignees", assignees.length)
                    : t("agenda.assignOptional")
                }
              />
              <AssigneeTagInput
                assignees={assignees}
                onChange={setAssignees}
                manualSuggestions={manualSuggestions}
              />
            </section>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-m3-border/40 mt-1">
          <Button variant="outline" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={available.length === 0}
          >
            {t("agenda.add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Edit the assignees of an existing responsibility                   */
/* ------------------------------------------------------------------ */

interface EditAssigneesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryLabel: string;
  assignees: Assignee[];
  manualSuggestions?: Assignee[];
  onSubmit: (assignees: Assignee[]) => void;
}

export const EditAssigneesModal: React.FC<EditAssigneesModalProps> = ({
  isOpen,
  onClose,
  categoryLabel,
  assignees,
  manualSuggestions,
  onSubmit,
}) => {
  const { t, tc } = useI18n();
  const [value, setValue] = useState<Assignee[]>(assignees);

  useEffect(() => {
    if (isOpen) setValue(assignees);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("agenda.assigneesTitle", { category: categoryLabel })}
    >
      <div className="space-y-5 pt-2">
        <SectionHeader
          icon={<Users className="w-3.5 h-3.5" />}
          title={categoryLabel}
          hint={
            value.length > 0
              ? tc("agenda.assignedAssignees", value.length)
              : t("agenda.noAssigneesYet")
          }
        />
        <AssigneeTagInput
          assignees={value}
          onChange={setValue}
          manualSuggestions={manualSuggestions}
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-m3-border/40">
          <Button variant="outline" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => onSubmit(value)}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
