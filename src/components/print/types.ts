/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AgendaEvent,
  Collection,
  Folder,
  ResponsibilityCategory,
  Service,
  Song,
} from "@/src/types";

export type PrintTemplateFamily =
  | "modern"
  | "classic"
  | "contemporary"
  | "compact"
  | "elegant"
  | "bulletin"
  | "leadsheet"
  | "hymnal";

export type PrintDensity = "tight" | "normal" | "relaxed";
export type PrintPaperSize = "a4" | "letter" | "a5";
export type PrintMargins = "narrow" | "normal" | "wide";

export interface PrintOptions {
  templateFamily: PrintTemplateFamily;
  showChords: boolean;
  twoColumnLayout: boolean;
  /** Base font size in px; every other size in the templates is relative. */
  fontSize: number;
  /** Vertical rhythm: gap between sections, lines and table rows. */
  density: PrintDensity;
  paperSize: PrintPaperSize;
  margins: PrintMargins;
  showChurchHeader: boolean;
  showChurchLogo: boolean;
  showMetadata: boolean;
  showSectionLabels: boolean;
  showPageNumbers: boolean;
  /** When off, the accent colour is replaced by ink so prints stay greyscale. */
  useAccentColor: boolean;
  /** Print the full songs after a folder / collection index or service rundown. */
  includeSongs: boolean;
  pageBreakBetweenItems: boolean;
  customFooter: string;
}

/** The subset of options stored as organisation defaults. */
export type OrgPrintSettings = Omit<PrintOptions, "includeSongs">;

export type PrintItem =
  | { type: "song"; data: Song }
  | { type: "folder"; data: Folder; songs?: Song[] }
  | { type: "collection"; data: Collection; songs?: Song[] }
  | { type: "service"; data: Service; songs?: Song[] }
  | { type: "event"; data: AgendaEvent; categories?: ResponsibilityCategory[] };

export interface PrintPayload {
  title?: string;
  items: PrintItem[];
  options?: Partial<PrintOptions>;
}

/** Church identity shared by every sheet of a document. */
export interface PrintBrand {
  churchName?: string;
  churchShortName?: string;
  churchLogo?: string | null;
  accentColor: string;
  locale: string;
}

export interface TemplateFamilyInfo {
  id: PrintTemplateFamily;
  /** Options applied when the template is picked, so it looks as intended. */
  presets?: Partial<PrintOptions>;
  /** What the template is best at, shown as hints in the picker. */
  bestFor: Array<"songs" | "services" | "events" | "songbooks">;
}
