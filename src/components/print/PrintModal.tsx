/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { useAuth } from "@/src/contexts/AuthContext";
import { useI18n } from "@/src/lib/i18n";
import { Columns, Minus, Plus, Printer, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { triggerPrint } from "./printEngine";
import { TEMPLATE_FAMILIES } from "./templateFamilies";
import { BatchPrintView } from "./templates/BatchPrintView";
import { PrintOptions, PrintPayload, PrintTemplateFamily } from "./types";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: PrintPayload | null;
  defaultOptions?: Partial<PrintOptions>;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  payload,
  defaultOptions = {},
}) => {
  const { organization } = useAuth();
  const { t } = useI18n();
  const previewRef = useRef<HTMLDivElement>(null);

  const orgMetadata = (organization?.metadata as Record<string, unknown>) || {};
  const orgSettings = (orgMetadata.settings as Record<string, unknown>) || {};
  const savedPrintSettings = (orgSettings.print as Partial<PrintOptions>) || {};

  // Active options state initialized from org settings + payload overrides
  const [options, setOptions] = useState<PrintOptions>({
    templateFamily:
      payload?.options?.templateFamily ||
      savedPrintSettings.templateFamily ||
      defaultOptions.templateFamily ||
      "modern",
    showChords:
      payload?.options?.showChords ??
      savedPrintSettings.showChords ??
      defaultOptions.showChords ??
      true,
    twoColumnLayout:
      payload?.options?.twoColumnLayout ??
      savedPrintSettings.twoColumnLayout ??
      defaultOptions.twoColumnLayout ??
      false,
    fontSize:
      payload?.options?.fontSize ??
      savedPrintSettings.fontSize ??
      defaultOptions.fontSize ??
      13,
    showChurchHeader:
      payload?.options?.showChurchHeader ??
      savedPrintSettings.showChurchHeader ??
      defaultOptions.showChurchHeader ??
      true,
    showChurchLogo:
      payload?.options?.showChurchLogo ??
      savedPrintSettings.showChurchLogo ??
      defaultOptions.showChurchLogo ??
      true,
    showMetadata:
      payload?.options?.showMetadata ??
      savedPrintSettings.showMetadata ??
      defaultOptions.showMetadata ??
      true,
    includeServiceSongs:
      payload?.options?.includeServiceSongs ??
      defaultOptions.includeServiceSongs ??
      true,
    includeFolderSongs:
      payload?.options?.includeFolderSongs ??
      defaultOptions.includeFolderSongs ??
      true,
    pageBreakBetweenItems:
      payload?.options?.pageBreakBetweenItems ??
      savedPrintSettings.pageBreakBetweenItems ??
      defaultOptions.pageBreakBetweenItems ??
      true,
    customFooter:
      payload?.options?.customFooter ??
      savedPrintSettings.customFooter ??
      defaultOptions.customFooter ??
      "",
  });

  // Re-sync options when payload opens
  useEffect(() => {
    if (payload && isOpen) {
      setOptions((prev) => ({
        ...prev,
        templateFamily:
          payload.options?.templateFamily ||
          savedPrintSettings.templateFamily ||
          prev.templateFamily,
        showChords:
          payload.options?.showChords ??
          savedPrintSettings.showChords ??
          prev.showChords,
        twoColumnLayout:
          payload.options?.twoColumnLayout ??
          savedPrintSettings.twoColumnLayout ??
          prev.twoColumnLayout,
        fontSize:
          payload.options?.fontSize ??
          savedPrintSettings.fontSize ??
          prev.fontSize,
        showChurchHeader:
          payload.options?.showChurchHeader ??
          savedPrintSettings.showChurchHeader ??
          prev.showChurchHeader,
        showChurchLogo:
          payload.options?.showChurchLogo ??
          savedPrintSettings.showChurchLogo ??
          prev.showChurchLogo,
        showMetadata:
          payload.options?.showMetadata ??
          savedPrintSettings.showMetadata ??
          prev.showMetadata,
        includeServiceSongs:
          payload.options?.includeServiceSongs ?? prev.includeServiceSongs,
        includeFolderSongs:
          payload.options?.includeFolderSongs ?? prev.includeFolderSongs,
        pageBreakBetweenItems:
          payload.options?.pageBreakBetweenItems ??
          savedPrintSettings.pageBreakBetweenItems ??
          prev.pageBreakBetweenItems,
        customFooter:
          payload.options?.customFooter ??
          savedPrintSettings.customFooter ??
          prev.customFooter,
      }));
    }
  }, [payload, isOpen, savedPrintSettings]);

  if (!isOpen || !payload || payload.items.length === 0) return null;

  const churchName = organization?.name || "";
  const churchLogo = organization?.logo || null;
  const churchShortName =
    (orgMetadata.shortName as string) || organization?.slug || "";
  const appearance = (orgSettings.appearance as Record<string, unknown>) || {};
  const accentColor = (appearance.accentColor as string) || "#0284c7";

  const title = payload.title || t("print.documentDefaultTitle");

  const hasSongs = payload.items.some(
    (i) =>
      i.type === "song" ||
      (i.type === "folder" && (i.songs?.length ?? 0) > 0) ||
      (i.type === "service" && (i.songs?.length ?? 0) > 0),
  );

  const hasFolderOrService = payload.items.some(
    (i) => i.type === "folder" || i.type === "service",
  );

  const handlePrint = () => {
    if (previewRef.current) {
      triggerPrint(previewRef.current, title);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col w-full max-w-6xl h-[94vh] overflow-hidden">
        {/* ── MODAL TOP BAR ── */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t("print.modalTitle")}</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (
                  {payload.items.length === 1
                    ? t("print.itemsCount", { count: payload.items.length })
                    : t("print.itemsCountPlural", {
                        count: payload.items.length,
                      })}
                  )
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-slate-600 dark:text-slate-400"
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
              className="shadow-sm"
            >
              {t("common.print")}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── TOOLBAR / CONTROLS ── */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Template Family Selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider flex items-center gap-1">
              {t("print.template")}
            </span>
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {TEMPLATE_FAMILIES.map((family) => {
                const active = options.templateFamily === family.id;
                const badge =
                  family.id === "modern"
                    ? t("print.templates.modern.badge")
                    : family.id === "classic"
                      ? t("print.templates.classic.badge")
                      : family.id === "contemporary"
                        ? t("print.templates.contemporary.badge")
                        : t("print.templates.compact.badge");
                const desc =
                  family.id === "modern"
                    ? t("print.templates.modern.description")
                    : family.id === "classic"
                      ? t("print.templates.classic.description")
                      : family.id === "contemporary"
                        ? t("print.templates.contemporary.description")
                        : t("print.templates.compact.description");
                return (
                  <button
                    key={family.id}
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        templateFamily: family.id as PrintTemplateFamily,
                      }))
                    }
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                      active
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    title={desc}
                  >
                    {badge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Chords toggle (only relevant if songs exist) */}
            {hasSongs && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={options.showChords}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      showChords: e.target.checked,
                    }))
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                />
                <span>{t("print.chords")}</span>
              </label>
            )}

            {/* Two Column Layout toggle */}
            {hasSongs && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={options.twoColumnLayout}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      twoColumnLayout: e.target.checked,
                    }))
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                />
                <Columns className="w-3.5 h-3.5 text-slate-400" />
                <span>{t("print.twoColumns")}</span>
              </label>
            )}

            {/* Church Header toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={options.showChurchHeader}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    showChurchHeader: e.target.checked,
                  }))
                }
                className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
              />
              <span>{t("print.churchHeader")}</span>
            </label>

            {/* Include Songs toggle (when printing folder or service) */}
            {hasFolderOrService && hasSongs && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={
                    options.includeServiceSongs &&
                    options.includeFolderSongs &&
                    hasSongs
                  }
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      includeServiceSongs: e.target.checked,
                      includeFolderSongs: e.target.checked,
                    }))
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                />
                <span>{t("print.includeChords")}</span>
              </label>
            )}

            {/* Font Size Stepper */}
            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">
                {t("print.fontSize")}
              </span>
              <button
                onClick={() =>
                  setOptions((prev) => ({
                    ...prev,
                    fontSize: Math.max(10, prev.fontSize - 1),
                  }))
                }
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                title={t("print.decreaseFont")}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-xs font-bold w-6 text-center text-slate-800 dark:text-slate-200">
                {options.fontSize}
              </span>
              <button
                onClick={() =>
                  setOptions((prev) => ({
                    ...prev,
                    fontSize: Math.min(20, prev.fontSize + 1),
                  }))
                }
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                title={t("print.increaseFont")}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── PREVIEW CANVAS (SCROLLABLE) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <div className="w-full max-w-4xl shadow-xl rounded-xl overflow-hidden bg-white border border-slate-200">
            <div ref={previewRef} className="hosana-print-container">
              <BatchPrintView
                items={payload.items}
                title={payload.title}
                options={options}
                churchName={churchName}
                churchLogo={churchLogo}
                churchShortName={churchShortName}
                accentColor={accentColor}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
