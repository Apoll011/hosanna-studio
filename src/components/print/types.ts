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
  "modern" | "classic" | "contemporary" | "compact";

export interface PrintOptions {
  templateFamily: PrintTemplateFamily;
  showChords: boolean;
  twoColumnLayout: boolean;
  fontSize: number; // e.g. 13
  showChurchHeader: boolean;
  showChurchLogo: boolean;
  showMetadata: boolean;
  includeServiceSongs: boolean;
  includeFolderSongs: boolean;
  includeCollectionSongs?: boolean;
  pageBreakBetweenItems: boolean;
  customFooter: string;
}

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

export interface TemplateFamilyInfo {
  id: PrintTemplateFamily;
  name: string;
  namePt: string;
  description: string;
  descriptionPt: string;
  badge: string;
  fontFamily: string;
  previewClass: string;
}
