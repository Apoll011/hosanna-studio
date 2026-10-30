/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import type { ChordProDiffLabels } from "@hosanna/chordpro/diff";
import type React from "react";
import { useMemo } from "react";

/** Maps the shared diff editor's `--hcd-*` tokens onto the app theme. */
export const DIFF_THEME_STYLE = {
  "--hcd-bg": "var(--m3-card)",
  "--hcd-fg": "var(--m3-text)",
  "--hcd-muted": "var(--m3-secondary)",
  "--hcd-border": "var(--m3-border)",
  "--hcd-toolbar-bg": "var(--m3-sidebar)",
  "--hcd-gutter-bg": "var(--m3-sidebar)",
  "--hcd-gutter-fg": "var(--m3-input)",
  "--hcd-hover": "var(--m3-hover)",
  "--hcd-accent": "var(--m3-primary)",
  "--hcd-accent-fg": "#ffffff",
  "--hcd-add-edge": "var(--m3-success)",
  "--hcd-del-edge": "var(--m3-danger)",
  "--hcd-add-bg": "color-mix(in srgb, var(--m3-success) 14%, transparent)",
  "--hcd-add-gutter": "color-mix(in srgb, var(--m3-success) 24%, transparent)",
  "--hcd-add-mark": "color-mix(in srgb, var(--m3-success) 38%, transparent)",
  "--hcd-del-bg": "color-mix(in srgb, var(--m3-danger) 13%, transparent)",
  "--hcd-del-gutter": "color-mix(in srgb, var(--m3-danger) 22%, transparent)",
  "--hcd-del-mark": "color-mix(in srgb, var(--m3-danger) 36%, transparent)",
  "--hcd-fold-bg": "color-mix(in srgb, var(--m3-primary) 9%, transparent)",
  "--hcd-chord": "var(--m3-primary)",
  "--hcd-directive": "var(--m3-secondary)",
  "--hcd-comment": "var(--m3-input)",
  "--hcd-font": "var(--font-mono, ui-monospace, Menlo, Consolas, monospace)",
} as React.CSSProperties;

/** Localised strings for the shared diff editor. */
export function useDiffLabels(): Partial<ChordProDiffLabels> {
  const { t } = useI18n();
  return useMemo(
    () => ({
      original: t("ai.chat.diff.original"),
      modified: t("ai.chat.diff.modified"),
      noChanges: t("ai.chat.diff.noChanges"),
      changeCounter: t("ai.chat.diff.changeCounter"),
      unchangedLines: t("ai.chat.diff.unchangedLines"),
      previous: t("ai.chat.diff.previous"),
      next: t("ai.chat.diff.next"),
      inline: t("ai.chat.diff.inline"),
      split: t("ai.chat.diff.split"),
      collapseUnchanged: t("ai.chat.diff.collapseUnchanged"),
      showAll: t("ai.chat.diff.showAll"),
      keep: t("ai.chat.diff.keep"),
      undo: t("ai.chat.diff.undo"),
      keepAll: t("ai.chat.diff.keepAll"),
      undoAll: t("ai.chat.diff.undoAll"),
      apply: t("ai.chat.diff.apply"),
      applyPartial: t("ai.chat.diff.applyPartial"),
      discard: t("ai.chat.diff.discard"),
      jumpToChange: t("ai.chat.diff.jumpToChange"),
    }),
    [t],
  );
}
