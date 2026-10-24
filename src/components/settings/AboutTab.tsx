/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { songImportRegistry } from "@/src/lib/import";
import { useActiveRole } from "@/src/lib/permissions/client";
import { startInteractiveOnboarding, startProductTour } from "@/src/lib/tour";
import {
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  FileUp,
  Github,
  Heart,
  Info,
} from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export const AboutTab: React.FC<{ active: boolean }> = ({ active }) => {
  const { organization } = useAuth();
  const { t } = useI18n();
  const { role } = useActiveRole();
  const [showLicenses, setShowLicenses] = useState(false);
  const canRelaunchTour = role !== "guest";

  if (!active) return null;
  const productionDependencies = [
    // --- Dependências Existentes ---
    { name: "Better Auth", license: "MIT", type: "Autenticação & RBAC" },
    { name: "@tailwindcss/vite", license: "MIT", type: "Estilização" },
    { name: "Lucide React", license: "ISC", type: "Ícones" },
    { name: "React Router Dom", license: "MIT", type: "Navegação" },

    // --- Adicionadas do @hosanna/studio ---
    {
      name: "@atlaskit/pragmatic-drag-and-drop",
      license: "Apache-2.0",
      type: "Drag & Drop",
    },
    {
      name: "@atlaskit/pragmatic-drag-and-drop-hitbox",
      license: "Apache-2.0",
      type: "Drag & Drop",
    },
    {
      name: "@hosanna/chordpro",
      license: "Apache-2.0",
      type: "Editor, Renderizador e Parser ChordPro",
    },
    { name: "ace-builds", license: "BSD-3-Clause", type: "Editor de Código" },
    { name: "autoprefixer", license: "MIT", type: "Processador CSS" },
    {
      name: "better-inbox",
      license: "MIT",
      type: "Comunicação / Notificações",
    },
    {
      name: "dotenv",
      license: "BSD-2-Clause",
      type: "Gestão de Variáveis de Ambiente",
    },
    { name: "preact", license: "MIT", type: "Framework UI" },
    { name: "qrcode.react", license: "ISC", type: "Geração de QR Code" },
    {
      name: "react-ace",
      license: "MIT",
      type: "Componente de Editor de Código",
    },
    {
      name: "react-error-boundary",
      license: "MIT",
      type: "Tratamento de Erros UI",
    },
    { name: "react-hook-form", license: "MIT", type: "Gestão de Formulários" },
    { name: "tailwindcss", license: "MIT", type: "Estilização" },
  ];
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-sky-50 dark:bg-sky-950/50 rounded-xl shrink-0">
              <Info className="w-6 h-6 text-m3-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t("settings.about.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("settings.about.controlPanel")}{" "}
                {organization?.name ? `• ${organization.name}` : ""}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                {t("settings.about.copyright", {
                  year: new Date().getFullYear(),
                })}
              </p>
            </div>
          </div>
          <div className="sm:text-right shrink-0 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl self-start sm:self-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
              {t("settings.about.studioVersion")}
            </span>
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
              {APP_VERSION}
            </span>
          </div>
        </div>

        {/* Open Source Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl gap-3">
          <div className="flex items-center gap-2.5">
            <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 fill-emerald-500/20" />
            <p
              className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("settings.about.openSourceBanner"),
              }}
            />
          </div>
          <a
            href="https://github.com/Apoll011/Hosana-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-700/55 transition-colors shrink-0"
          >
            <Github className="w-3.5 h-3.5" />
            {t("settings.about.viewRepo")}
          </a>
        </div>

        {canRelaunchTour && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 rounded-xl gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Compass className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                  {t("settings.about.productTourTitle")}
                </p>
                <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 mt-0.5 leading-relaxed">
                  {t("settings.about.productTourDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => startProductTour()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-700/55 transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                {t("settings.about.productTourRelaunch")}
              </button>
              <button
                type="button"
                onClick={() => startInteractiveOnboarding()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-white dark:bg-slate-800 border border-violet-200 dark:border-slate-700 rounded-lg hover:bg-violet-50 dark:hover:bg-slate-700/55 transition-colors cursor-pointer"
              >
                {t("settings.about.interactiveTourRelaunch")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Formats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
          <FileUp className="w-4 h-4 text-m3-primary" />
          {t("settings.about.supportedFormats")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {songImportRegistry.getProviders().map((provider) => (
            <div
              key={provider.id}
              className="flex flex-col justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-m3-primary" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {provider.name}
                  </span>
                </div>
                {provider.description && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {provider.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open Source Licenses Accordion */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <button
          onClick={() => setShowLicenses(!showLicenses)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            {t("settings.about.thirdPartyLicenses", {
              count: productionDependencies.length,
            })}
          </span>
          {showLicenses ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showLicenses && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {productionDependencies.map((dep, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/40 last:border-none"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dep.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{dep.type}</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                    {dep.license}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
