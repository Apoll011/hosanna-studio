/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Minus, Plus } from "lucide-react";
import React, { useId } from "react";
import {
  clampFontSize,
  DEFAULT_PRINT_OPTIONS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
} from "./options";
import { getTemplateFamilyInfo } from "./templateFamilies";
import { TemplatePicker } from "./TemplatePicker";
import {
  PrintBrand,
  PrintDensity,
  PrintMargins,
  PrintOptions,
  PrintPaperSize,
  PrintTemplateFamily,
} from "./types";

/* ── Small controls ─────────────────────────────────────────────── */

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="space-y-2.5">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-m3-secondary">
      {title}
    </h3>
    {children}
  </section>
);

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  hint,
  checked,
  onChange,
  disabled,
}) => {
  const id = useId();
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1 ${disabled ? "opacity-50" : ""}`}
    >
      <label
        htmlFor={id}
        className={`min-w-0 ${disabled ? "" : "cursor-pointer"}`}
      >
        <span className="block text-[13px] font-medium text-m3-text leading-tight">
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] text-m3-secondary leading-snug mt-0.5">
            {hint}
          </span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m3-primary ${
          checked ? "bg-m3-primary" : "bg-m3-border"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
};

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="text-[13px] font-medium text-m3-text mb-1.5">{label}</div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1 p-1 rounded-[var(--radius-md)] bg-m3-sidebar border border-m3-border/60"
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`min-h-8 px-2 rounded-[var(--radius-sm)] text-xs font-semibold transition-colors ${
                active
                  ? "bg-m3-card text-m3-text shadow-[var(--shadow-sm)]"
                  : "text-m3-secondary hover:text-m3-text"
              } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FontSizeControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { t } = useI18n();
  const stepClass =
    "inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] text-m3-secondary hover:text-m3-text hover:bg-m3-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium text-m3-text">
          {t("print.options.fontSize")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={stepClass}
            disabled={disabled || value <= FONT_SIZE_MIN}
            onClick={() => onChange(clampFontSize(value - 1))}
            aria-label={t("print.options.decreaseFont")}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center text-xs font-mono font-semibold text-m3-text tabular-nums">
            {value}px
          </span>
          <button
            type="button"
            className={stepClass}
            disabled={disabled || value >= FONT_SIZE_MAX}
            onClick={() => onChange(clampFontSize(value + 1))}
            aria-label={t("print.options.increaseFont")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={1}
        value={value}
        disabled={disabled}
        onInput={(e) =>
          onChange(clampFontSize(Number((e.target as HTMLInputElement).value)))
        }
        aria-label={t("print.options.fontSize")}
        className="w-full accent-[var(--m3-primary)] cursor-pointer disabled:cursor-not-allowed"
      />
      {value !== DEFAULT_PRINT_OPTIONS.fontSize && !disabled && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_PRINT_OPTIONS.fontSize)}
          className="text-[11px] text-m3-primary hover:underline cursor-pointer"
        >
          {t("print.options.resetFont", {
            size: DEFAULT_PRINT_OPTIONS.fontSize,
          })}
        </button>
      )}
    </div>
  );
};

/* ── Panel ──────────────────────────────────────────────────────── */

export interface PrintOptionsContext {
  /** Whether any song body will be printed (controls song-only options). */
  hasSongs: boolean;
  /** Whether "include full songs" applies (folders, collections, services). */
  hasSongContainers: boolean;
}

interface PrintOptionsPanelProps {
  options: PrintOptions;
  onChange: (patch: Partial<PrintOptions>) => void;
  brand: PrintBrand;
  context: PrintOptionsContext;
  disabled?: boolean;
  /** "sidebar" stacks everything; "wide" lays groups out in columns. */
  layout?: "sidebar" | "wide";
}

export const PrintOptionsPanel: React.FC<PrintOptionsPanelProps> = ({
  options,
  onChange,
  brand,
  context,
  disabled,
  layout = "sidebar",
}) => {
  const { t } = useI18n();
  const wide = layout === "wide";

  const selectTemplate = (family: PrintTemplateFamily) =>
    onChange({
      ...getTemplateFamilyInfo(family).presets,
      templateFamily: family,
    });

  const groups = (
    <>
      <Group title={t("print.options.groups.content")}>
        <div className="divide-y divide-m3-border/50">
          {context.hasSongs && (
            <>
              <ToggleRow
                label={t("print.options.chords")}
                hint={t("print.options.chordsHint")}
                checked={options.showChords}
                onChange={(v) => onChange({ showChords: v })}
                disabled={disabled}
              />
              <ToggleRow
                label={t("print.options.metadata")}
                hint={t("print.options.metadataHint")}
                checked={options.showMetadata}
                onChange={(v) => onChange({ showMetadata: v })}
                disabled={disabled}
              />
              <ToggleRow
                label={t("print.options.sectionLabels")}
                hint={t("print.options.sectionLabelsHint")}
                checked={options.showSectionLabels}
                onChange={(v) => onChange({ showSectionLabels: v })}
                disabled={disabled}
              />
            </>
          )}
          {context.hasSongContainers && (
            <ToggleRow
              label={t("print.options.includeSongs")}
              hint={t("print.options.includeSongsHint")}
              checked={options.includeSongs}
              onChange={(v) => onChange({ includeSongs: v })}
              disabled={disabled}
            />
          )}
          <ToggleRow
            label={t("print.options.churchHeader")}
            hint={t("print.options.churchHeaderHint")}
            checked={options.showChurchHeader}
            onChange={(v) => onChange({ showChurchHeader: v })}
            disabled={disabled}
          />
          <ToggleRow
            label={t("print.options.churchLogo")}
            checked={options.showChurchLogo}
            onChange={(v) => onChange({ showChurchLogo: v })}
            disabled={disabled || !options.showChurchHeader}
          />
        </div>
      </Group>

      <Group title={t("print.options.groups.layout")}>
        <div className="space-y-3.5">
          <FontSizeControl
            value={options.fontSize}
            onChange={(v) => onChange({ fontSize: v })}
            disabled={disabled}
          />
          <Segmented<PrintDensity>
            label={t("print.options.density")}
            value={options.density}
            onChange={(v) => onChange({ density: v })}
            disabled={disabled}
            options={[
              { value: "tight", label: t("print.options.densityTight") },
              { value: "normal", label: t("print.options.densityNormal") },
              { value: "relaxed", label: t("print.options.densityRelaxed") },
            ]}
          />
          {context.hasSongs && (
            <Segmented<"1" | "2">
              label={t("print.options.columns")}
              value={options.twoColumnLayout ? "2" : "1"}
              onChange={(v) => onChange({ twoColumnLayout: v === "2" })}
              disabled={disabled}
              options={[
                { value: "1", label: t("print.options.oneColumn") },
                { value: "2", label: t("print.options.twoColumns") },
              ]}
            />
          )}
          <div className="divide-y divide-m3-border/50">
            <ToggleRow
              label={t("print.options.pageBreak")}
              hint={t("print.options.pageBreakHint")}
              checked={options.pageBreakBetweenItems}
              onChange={(v) => onChange({ pageBreakBetweenItems: v })}
              disabled={disabled}
            />
          </div>
        </div>
      </Group>

      <Group title={t("print.options.groups.page")}>
        <div className="space-y-3.5">
          <Segmented<PrintPaperSize>
            label={t("print.options.paper")}
            value={options.paperSize}
            onChange={(v) => onChange({ paperSize: v })}
            disabled={disabled}
            options={[
              { value: "a4", label: "A4" },
              { value: "letter", label: t("print.options.letter") },
              { value: "a5", label: "A5" },
            ]}
          />
          <Segmented<PrintMargins>
            label={t("print.options.margins")}
            value={options.margins}
            onChange={(v) => onChange({ margins: v })}
            disabled={disabled}
            options={[
              { value: "narrow", label: t("print.options.marginsNarrow") },
              { value: "normal", label: t("print.options.marginsNormal") },
              { value: "wide", label: t("print.options.marginsWide") },
            ]}
          />
          <div className="divide-y divide-m3-border/50">
            <ToggleRow
              label={t("print.options.pageNumbers")}
              hint={t("print.options.pageNumbersHint")}
              checked={options.showPageNumbers}
              onChange={(v) => onChange({ showPageNumbers: v })}
              disabled={disabled}
            />
            <ToggleRow
              label={t("print.options.accentColor")}
              hint={t("print.options.accentColorHint")}
              checked={options.useAccentColor}
              onChange={(v) => onChange({ useAccentColor: v })}
              disabled={disabled}
            />
          </div>
          <label className="block">
            <span className="block text-[13px] font-medium text-m3-text mb-1.5">
              {t("print.options.footer")}
            </span>
            <input
              type="text"
              value={options.customFooter}
              disabled={disabled}
              maxLength={160}
              placeholder={t("print.options.footerPlaceholder")}
              onChange={(e) => onChange({ customFooter: e.target.value })}
              className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-md)] border border-m3-border bg-m3-sidebar text-m3-text placeholder:text-m3-secondary/70 focus:outline-none focus:ring-2 focus:ring-m3-primary/30 focus:border-m3-primary disabled:opacity-50"
            />
          </label>
        </div>
      </Group>
    </>
  );

  return (
    <div className="space-y-6">
      <Group title={t("print.options.groups.template")}>
        <TemplatePicker
          value={options.templateFamily}
          onSelect={selectTemplate}
          brand={brand}
          showChords={options.showChords}
          disabled={disabled}
          className={
            wide
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              : "grid grid-cols-2 gap-2.5"
          }
        />
        <p className="text-[11px] text-m3-secondary leading-snug">
          {t(`print.templates.${options.templateFamily}.description`)}
        </p>
      </Group>

      {wide ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{groups}</div>
      ) : (
        groups
      )}
    </div>
  );
};
