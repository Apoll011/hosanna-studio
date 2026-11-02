/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { toOrgPrintSettings } from "@/src/components/print/options";
import { PrintOptionsPanel } from "@/src/components/print/PrintOptionsPanel";
import {
  OrgPrintSettings,
  PrintBrand,
  PrintOptions,
} from "@/src/components/print/types";
import { useAuth } from "@/src/contexts/AuthContext";
import { useI18n } from "@/src/lib/i18n";
import { Eye, Printer } from "lucide-react";
import React, { useMemo } from "react";

interface PrintingSettingsCardProps {
  isEditing: boolean;
  settings: OrgPrintSettings;
  onUpdate: (updater: (prev: OrgPrintSettings) => OrgPrintSettings) => void;
  canManageOrg: boolean;
  onTestPrint: () => void;
}

const SETTINGS_CONTEXT = { hasSongs: true, hasSongContainers: false };

export const PrintingSettingsCard: React.FC<PrintingSettingsCardProps> = ({
  isEditing,
  settings,
  onUpdate,
  canManageOrg,
  onTestPrint,
}) => {
  const { t, locale } = useI18n();
  const { organization } = useAuth();

  const brand = useMemo<PrintBrand>(() => {
    const meta = (organization?.metadata as Record<string, unknown>) || {};
    const orgSettings = (meta.settings as Record<string, unknown>) || {};
    const appearance =
      (orgSettings.appearance as Record<string, unknown>) || {};
    return {
      churchName: organization?.name || "",
      churchShortName: (meta.shortName as string) || undefined,
      churchLogo: organization?.logo || null,
      accentColor: (appearance.accentColor as string) || "#0284c7",
      locale,
    };
  }, [organization, locale]);

  const options: PrintOptions = { ...settings, includeSongs: true };
  const handleChange = (patch: Partial<PrintOptions>) =>
    onUpdate((prev) =>
      toOrgPrintSettings({ ...prev, includeSongs: true, ...patch }),
    );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all mt-6">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
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
          className="shrink-0"
        >
          {t("print.settingsCard.testModel")}
        </Button>
      </div>

      <div className="p-6">
        {!isEditing && canManageOrg && (
          <p className="text-xs text-m3-secondary mb-4">
            {t("print.settingsCard.editHint")}
          </p>
        )}
        <PrintOptionsPanel
          options={options}
          onChange={handleChange}
          brand={brand}
          context={SETTINGS_CONTEXT}
          disabled={!isEditing || !canManageOrg}
          layout="wide"
        />
      </div>
    </div>
  );
};
