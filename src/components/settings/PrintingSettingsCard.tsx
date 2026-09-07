/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { TEMPLATE_FAMILIES } from "@/src/components/print/templateFamilies";
import { PrintTemplateFamily } from "@/src/components/print/types";
import { OrgPrintSettings } from "@/src/hooks/useOrgSettings";
import { useI18n } from "@/src/lib/i18n";
import {
  Check,
  Columns,
  Eye,
  FileText,
  Minus,
  Music,
  Plus,
  Printer,
} from "lucide-react";
import React from "react";

interface PrintingSettingsCardProps {
  isEditing: boolean;
  settings: OrgPrintSettings;
  onUpdate: (updater: (prev: OrgPrintSettings) => OrgPrintSettings) => void;
  canManageOrg: boolean;
  onTestPrint: () => void;
}

export const PrintingSettingsCard: React.FC<PrintingSettingsCardProps> = ({
  isEditing,
  settings,
  onUpdate,
  canManageOrg,
  onTestPrint,
}) => {
  const { t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all mt-6">
      {/* Card Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-500" />
            <span>{t("print.settingsCard.title")}</span>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("print.settingsCard.description")}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Eye className="w-4 h-4 text-sky-500" />}
          onClick={onTestPrint}
        >
          {t("print.settingsCard.testModel")}
        </Button>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-6">
        {/* 1. SELEÇÃO DA FAMÍLIA DE MODELOS */}
        <div>
          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block mb-3 items-center gap-1.5">
            <span>{t("print.settingsCard.visualFamily")}</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {TEMPLATE_FAMILIES.map((family) => {
              const isSelected = settings.templateFamily === family.id;

              return (
                <div
                  key={family.id}
                  onClick={() => {
                    if (isEditing && canManageOrg) {
                      onUpdate((prev) => ({
                        ...prev,
                        templateFamily: family.id as PrintTemplateFamily,
                      }));
                    }
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left flex flex-col justify-between ${
                    isSelected
                      ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/30 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  } ${isEditing && canManageOrg ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {family.badge}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {family.namePt}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {family.descriptionPt}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span>
                      {family.id === "classic"
                        ? t("print.settingsCard.types.classic")
                        : family.id === "contemporary"
                          ? t("print.settingsCard.types.contemporary")
                          : family.id === "compact"
                            ? t("print.settingsCard.types.compact")
                            : t("print.settingsCard.types.modern")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. OPÇÕES E CUSTOMIZAÇÃO */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block mb-3">
            {t("print.settingsCard.layoutPresets")}
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mostrar Cifras */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 ${
                isEditing && canManageOrg
                  ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                  : "opacity-80"
              }`}
            >
              <input
                type="checkbox"
                disabled={!isEditing || !canManageOrg}
                checked={settings.showChords}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    showChords: e.target.checked,
                  }))
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-slate-400" />
                  {t("print.settingsCard.printChordsDefault")}
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("print.settingsCard.printChordsDefaultDesc")}
                </p>
              </div>
            </label>

            {/* Disposição em 2 Colunas */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 ${
                isEditing && canManageOrg
                  ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                  : "opacity-80"
              }`}
            >
              <input
                type="checkbox"
                disabled={!isEditing || !canManageOrg}
                checked={settings.twoColumnLayout}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    twoColumnLayout: e.target.checked,
                  }))
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-slate-400" />
                  {t("print.settingsCard.twoColumnLayout")}
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("print.settingsCard.twoColumnLayoutDesc")}
                </p>
              </div>
            </label>

            {/* Cabeçalho da Igreja */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 ${
                isEditing && canManageOrg
                  ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                  : "opacity-80"
              }`}
            >
              <input
                type="checkbox"
                disabled={!isEditing || !canManageOrg}
                checked={settings.showChurchHeader}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    showChurchHeader: e.target.checked,
                  }))
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {t("print.settingsCard.churchHeader")}
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("print.settingsCard.churchHeaderDesc")}
                </p>
              </div>
            </label>

            {/* Quebra de Página entre Itens */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 ${
                isEditing && canManageOrg
                  ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                  : "opacity-80"
              }`}
            >
              <input
                type="checkbox"
                disabled={!isEditing || !canManageOrg}
                checked={settings.pageBreakBetweenItems}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    pageBreakBetweenItems: e.target.checked,
                  }))
                }
                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {t("print.settingsCard.pageBreak")}
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("print.settingsCard.pageBreakDesc")}
                </p>
              </div>
            </label>
          </div>

          {/* Stepper de Tamanho de Fonte e Rodapé */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Stepper de Tamanho */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  {t("print.settingsCard.defaultFontSize")}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("print.settingsCard.defaultFontSizeDesc")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                <button
                  type="button"
                  disabled={
                    !isEditing || !canManageOrg || settings.fontSize <= 10
                  }
                  onClick={() =>
                    onUpdate((prev) => ({
                      ...prev,
                      fontSize: Math.max(10, prev.fontSize - 1),
                    }))
                  }
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                </button>
                <span className="font-mono text-xs font-bold w-7 text-center text-slate-900 dark:text-slate-100">
                  {settings.fontSize}
                </span>
                <button
                  type="button"
                  disabled={
                    !isEditing || !canManageOrg || settings.fontSize >= 22
                  }
                  onClick={() =>
                    onUpdate((prev) => ({
                      ...prev,
                      fontSize: Math.min(22, prev.fontSize + 1),
                    }))
                  }
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

            {/* Rodapé Personalizado */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">
                {t("print.settingsCard.customFooter")}
              </span>
              <input
                type="text"
                disabled={!isEditing || !canManageOrg}
                placeholder={t("print.settingsCard.customFooterPlaceholder")}
                value={settings.customFooter}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    customFooter: e.target.value,
                  }))
                }
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
