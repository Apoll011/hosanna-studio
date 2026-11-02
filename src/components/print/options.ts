/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isTemplateFamily } from "./templateFamilies";
import {
  OrgPrintSettings,
  PrintDensity,
  PrintMargins,
  PrintOptions,
  PrintPaperSize,
} from "./types";

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 20;

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  templateFamily: "modern",
  showChords: true,
  twoColumnLayout: false,
  fontSize: 13,
  density: "normal",
  paperSize: "a4",
  margins: "normal",
  showChurchHeader: true,
  showChurchLogo: true,
  showMetadata: true,
  showSectionLabels: true,
  showPageNumbers: true,
  useAccentColor: true,
  includeSongs: true,
  pageBreakBetweenItems: true,
  packSongsOnPage: false,
  customFooter: "",
};

/** Physical page sizes in millimetres. */
export const PAPER_SIZES: Record<PrintPaperSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
  a5: { w: 148, h: 210 },
};

export const PAGE_MARGINS_MM: Record<PrintMargins, number> = {
  narrow: 8,
  normal: 12,
  wide: 18,
};

const DENSITIES: PrintDensity[] = ["tight", "normal", "relaxed"];
const PAPERS = Object.keys(PAPER_SIZES) as PrintPaperSize[];
const MARGINS = Object.keys(PAGE_MARGINS_MM) as PrintMargins[];

const BOOLEAN_KEYS = [
  "showChords",
  "twoColumnLayout",
  "showChurchHeader",
  "showChurchLogo",
  "showMetadata",
  "showSectionLabels",
  "showPageNumbers",
  "useAccentColor",
  "includeSongs",
  "pageBreakBetweenItems",
  "packSongsOnPage",
] as const satisfies ReadonlyArray<keyof PrintOptions>;

/**
 * Validates one untrusted layer (org metadata, payload overrides…) and keeps
 * only the fields that are well-formed, so a bad stored value never breaks
 * printing.
 */
export function sanitizePrintOptions(raw: unknown): Partial<PrintOptions> {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: Partial<PrintOptions> = {};

  if (isTemplateFamily(input.templateFamily)) {
    out.templateFamily = input.templateFamily;
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") out[key] = input[key];
  }
  if (typeof input.fontSize === "number" && Number.isFinite(input.fontSize)) {
    out.fontSize = clampFontSize(input.fontSize);
  }
  if (DENSITIES.includes(input.density as PrintDensity)) {
    out.density = input.density as PrintDensity;
  }
  if (PAPERS.includes(input.paperSize as PrintPaperSize)) {
    out.paperSize = input.paperSize as PrintPaperSize;
  }
  if (MARGINS.includes(input.margins as PrintMargins)) {
    out.margins = input.margins as PrintMargins;
  }
  if (typeof input.customFooter === "string") {
    out.customFooter = input.customFooter;
  }

  // Legacy per-type flags, all of which were toggled together.
  if (out.includeSongs === undefined) {
    const legacy = [
      input.includeServiceSongs,
      input.includeFolderSongs,
      input.includeCollectionSongs,
    ].find((v) => typeof v === "boolean");
    if (typeof legacy === "boolean") out.includeSongs = legacy;
  }

  return out;
}

/** Merges option layers from lowest to highest priority over the defaults. */
export function resolvePrintOptions(...layers: unknown[]): PrintOptions {
  return layers.reduce<PrintOptions>(
    (acc, layer) => ({ ...acc, ...sanitizePrintOptions(layer) }),
    { ...DEFAULT_PRINT_OPTIONS },
  );
}

export function resolveOrgPrintSettings(raw: unknown): OrgPrintSettings {
  return toOrgPrintSettings(resolvePrintOptions(raw));
}

export function toOrgPrintSettings(options: PrintOptions): OrgPrintSettings {
  const { includeSongs: _omit, ...rest } = options;
  return rest;
}

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)));
}

export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}
