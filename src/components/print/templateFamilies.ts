/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrintTemplateFamily, TemplateFamilyInfo } from "./types";

export const TEMPLATE_FAMILIES: TemplateFamilyInfo[] = [
  { id: "modern", bestFor: ["songs", "services", "events"] },
  { id: "classic", bestFor: ["songs", "songbooks"] },
  { id: "contemporary", bestFor: ["songs"] },
  {
    id: "compact",
    presets: { density: "tight", twoColumnLayout: true, margins: "narrow" },
    bestFor: ["songbooks", "services"],
  },
  { id: "elegant", bestFor: ["songs", "events"] },
  { id: "bulletin", bestFor: ["services", "events"] },
  { id: "leadsheet", presets: { showChords: true }, bestFor: ["songs"] },
  {
    id: "hymnal",
    presets: { showSectionLabels: true },
    bestFor: ["songbooks", "songs"],
  },
];

export function getTemplateFamilyInfo(
  id: PrintTemplateFamily,
): TemplateFamilyInfo {
  return TEMPLATE_FAMILIES.find((f) => f.id === id) || TEMPLATE_FAMILIES[0];
}

export function isTemplateFamily(value: unknown): value is PrintTemplateFamily {
  return TEMPLATE_FAMILIES.some((f) => f.id === value);
}
