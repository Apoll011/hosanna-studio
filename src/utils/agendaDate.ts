/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TranslateFn, TranslationKey } from "@/src/lib/i18n";

const WEEKDAY_KEYS: TranslationKey[] = [
  "agenda.weekdaysFull.sunday",
  "agenda.weekdaysFull.monday",
  "agenda.weekdaysFull.tuesday",
  "agenda.weekdaysFull.wednesday",
  "agenda.weekdaysFull.thursday",
  "agenda.weekdaysFull.friday",
  "agenda.weekdaysFull.saturday",
];

const MONTH_KEYS: TranslationKey[] = [
  "agenda.months.january",
  "agenda.months.february",
  "agenda.months.march",
  "agenda.months.april",
  "agenda.months.may",
  "agenda.months.june",
  "agenda.months.july",
  "agenda.months.august",
  "agenda.months.september",
  "agenda.months.october",
  "agenda.months.november",
  "agenda.months.december",
];

/** "domingo, 4 de outubro de 2026" — localized weekday + day + month + year. */
export function formatLongDate(iso: string, t: TranslateFn): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return t("agenda.dateLong", {
    weekday: t(WEEKDAY_KEYS[date.getDay()]),
    day: d,
    month: t(MONTH_KEYS[m - 1]),
    year: y,
  });
}

/** "04/10/2026" — compact localized date. */
export function formatShortDate(iso: string, t: TranslateFn): string {
  const [y, m, d] = (iso || "").split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return iso || "";
  return t("agenda.dateShort", {
    day: String(d).padStart(2, "0"),
    month: String(m).padStart(2, "0"),
    year: y,
  });
}
