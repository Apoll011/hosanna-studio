/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Song } from "@/src/types";
import { Check } from "lucide-react";
import React, { useLayoutEffect } from "react";
import { DEFAULT_PRINT_OPTIONS } from "./options";
import { ensurePrintStyles } from "./printStyles";
import { TEMPLATE_FAMILIES } from "./templateFamilies";
import { PrintDocument } from "./templates/PrintDocument";
import { PrintBrand, PrintTemplateFamily } from "./types";

const SAMPLE_SONG: Song = {
  id: "template-thumbnail",
  title: "Quão Grande És Tu",
  artist: "Carl Boberg",
  song_number: 12,
  content: `{title: Quão Grande És Tu}
{artist: Carl Boberg}
{key: G}
{tempo: 72}
{time: 3/4}

{c: Verso 1}
[G]Senhor meu Deus, quando eu mara[C]vilhado
[G]Fico a pensar nas [D]obras de Tuas [G]mãos
[G]O céu azul de estrelas pon[C]tilhado
[G]Mostrando a glória [D]do Teu grande a[G]mor

{soc: Coro}
[D]Então minha alma [G]canta a Ti, Se[C]nhor
Quão grande és [G]Tu! Quão grande és [D]Tu!
{eoc}

{c: Verso 2}
[G]Quando eu contemplo a cruz daquela es[C]trada
[G]Onde Jesus por [D]mim ali mor[G]reu`,
  path: "",
  tags: [],
  createdAt: "",
  updatedAt: "",
};

const SAMPLE_ITEMS = [{ type: "song" as const, data: SAMPLE_SONG }];

interface TemplateThumbnailProps {
  family: PrintTemplateFamily;
  showChords: boolean;
  brand: PrintBrand;
}

/** A real, miniature render of the template — not a hand-drawn mock-up. */
const TemplateThumbnail = React.memo<TemplateThumbnailProps>(
  function TemplateThumbnail({ family, showChords, brand }) {
    const info = TEMPLATE_FAMILIES.find((f) => f.id === family);
    return (
      <div
        className="hp-thumb aspect-[4/3] overflow-hidden bg-white p-[7px]"
        aria-hidden="true"
      >
        <PrintDocument
          items={SAMPLE_ITEMS}
          options={{
            ...DEFAULT_PRINT_OPTIONS,
            ...info?.presets,
            templateFamily: family,
            showChords,
            fontSize: 5,
            pageBreakBetweenItems: false,
          }}
          brand={brand}
        />
      </div>
    );
  },
);

interface TemplatePickerProps {
  value: PrintTemplateFamily;
  onSelect: (family: PrintTemplateFamily) => void;
  brand: PrintBrand;
  showChords: boolean;
  disabled?: boolean;
  className?: string;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  value,
  onSelect,
  brand,
  showChords,
  disabled,
  className = "grid grid-cols-2 gap-2.5",
}) => {
  const { t } = useI18n();
  useLayoutEffect(ensurePrintStyles, []);

  return (
    <div className={className} role="radiogroup">
      {TEMPLATE_FAMILIES.map((family) => {
        const selected = value === family.id;
        return (
          <button
            key={family.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(family.id)}
            title={t(`print.templates.${family.id}.description`)}
            className={`group relative text-left rounded-[var(--radius-md)] border overflow-hidden transition-all disabled:cursor-default ${
              selected
                ? "border-m3-primary ring-2 ring-m3-primary/25"
                : "border-m3-border hover:border-m3-secondary/60 enabled:cursor-pointer"
            }`}
          >
            <div className="border-b border-m3-border/70 transition-opacity group-enabled:group-hover:opacity-90">
              <TemplateThumbnail
                family={family.id}
                showChords={showChords}
                brand={brand}
              />
            </div>
            <div className="px-2.5 py-1.5 bg-m3-card">
              <div className="text-xs font-semibold text-m3-text truncate">
                {t(`print.templates.${family.id}.name`)}
              </div>
              <div className="text-[11px] text-m3-secondary truncate">
                {t(`print.templates.${family.id}.tagline`)}
              </div>
            </div>
            {selected && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-m3-primary text-white flex items-center justify-center shadow-[var(--shadow-sm)]">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
