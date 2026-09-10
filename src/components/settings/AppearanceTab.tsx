/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { usePersonalSettings } from "@/src/hooks/usePersonalSettings";
import type { SongScoreLayout } from "@/src/hooks/usePersonalSettings";
import { useI18n } from "@/src/lib/i18n";
import { LANGUAGES } from "@/src/lib/i18n/languages";
import { PersonalLanguage } from "@/src/lib/i18n/types";
import { SongScoreVisualizer } from "@/src/components/explorer/SongScoreVisualizer";
import {
  BarChart2,
  Check,
  FolderTree,
  Globe,
  Layout,
  MonitorSmartphone,
  Moon,
  Music2,
  Sliders,
  Smartphone,
  Star,
  Sun,
  User,
} from "lucide-react";
import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export interface AppearanceTabProps {
  active: boolean;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

interface ThemeOption {
  id: "light" | "dark" | "system";
  title: string;
  description: string;
  icon: React.ElementType;
  previewBg: string;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  active,
  showToast,
}) => {
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = usePersonalSettings();
  const { t, personalLanguage, setPersonalLanguage } = useI18n();

  if (!active) return null;

  const themes: ThemeOption[] = [
    {
      id: "light",
      title: t("settings.appearance.light"),
      description: t("settings.appearance.lightDesc"),
      icon: Sun,
      previewBg:
        "from-amber-500/10 to-orange-500/5 text-amber-600 dark:text-amber-400",
    },
    {
      id: "system",
      title: t("settings.appearance.auto"),
      description: t("settings.appearance.autoDesc"),
      icon: MonitorSmartphone,
      previewBg:
        "from-slate-500/10 to-slate-600/5 text-slate-700 dark:text-slate-300",
    },
    {
      id: "dark",
      title: t("settings.appearance.dark"),
      description: t("settings.appearance.darkDesc"),
      icon: Moon,
      previewBg:
        "from-indigo-500/10 to-sky-500/5 text-sky-600 dark:text-sky-400",
    },
  ];

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    const label =
      newTheme === "system"
        ? t("settings.appearance.auto")
        : newTheme === "light"
          ? t("settings.appearance.light")
          : t("settings.appearance.dark");
    showToast?.(t("settings.toast.themeChanged", { theme: label }), "info");
  };

  const handleFolderTreeToggle = (checked: boolean) => {
    updateSetting("showFolderTree", checked);
    showToast?.(
      checked
        ? t("settings.toast.folderTreeVisible")
        : t("settings.toast.folderTreeHidden"),
      "success",
    );
  };

  const handleStudioSettingsChange = (checked: boolean) => {
    updateSetting("showChordsDefault", checked);
    showToast?.(
      checked
        ? t("settings.toast.chordsVisible")
        : t("settings.toast.chordsHidden"),
      "success",
    );
  };

  const handleLanguageChange = (lang: PersonalLanguage) => {
    setPersonalLanguage(lang);
    const label =
      lang === "auto"
        ? t("settings.appearance.languageAuto")
        : (LANGUAGES.find((l) => l.code === lang)?.nativeLabel ?? lang);
    showToast?.(
      t("settings.toast.languageChanged", { language: label }),
      "info",
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ========================================== */}
      {/* 1. TEMA & EXPERIÊNCIA VISUAL               */}
      {/* ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-m3-primary" />
              {t("settings.appearance.themeTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("settings.appearance.themeDesc")}
            </p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
            <User className="w-3.5 h-3.5" />
            {t("settings.appearance.personalPreference")}
          </span>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {themes.map((item) => {
              const Icon = item.icon;
              const selected = theme === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleThemeChange(item.id)}
                  aria-pressed={selected}
                  className={`group relative rounded-2xl border p-5 text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-m3-primary/50 ${
                    selected
                      ? "border-m3-primary bg-m3-primary/5 ring-2 ring-m3-primary/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-4 right-4 h-5 w-5 rounded-full bg-m3-primary flex items-center justify-center shadow-xs">
                      <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`inline-flex rounded-xl p-2.5 bg-linear-to-br border border-slate-200/50 dark:border-slate-700/50 ${item.previewBg}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. IDIOMA                                  */}
      {/* ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-m3-primary" />
              {t("settings.appearance.languageTitle")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("settings.appearance.languageDesc")}
            </p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
            <User className="w-3.5 h-3.5" />
            {t("settings.appearance.personalPreference")}
          </span>
        </div>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => handleLanguageChange("auto")}
              aria-pressed={personalLanguage === "auto"}
              className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                personalLanguage === "auto"
                  ? "border-m3-primary bg-m3-primary/5 ring-2 ring-m3-primary/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40"
              }`}
            >
              {personalLanguage === "auto" && (
                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-m3-primary flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                </div>
              )}
              <div className="text-2xl mb-2">🌐</div>
              <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">
                {t("settings.appearance.languageAuto")}
              </span>
              <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("settings.appearance.languageAutoDesc")}
              </span>
            </button>

            {LANGUAGES.map((lang) => {
              const selected = personalLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  aria-pressed={selected}
                  className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                    selected
                      ? "border-m3-primary bg-m3-primary/5 ring-2 ring-m3-primary/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-m3-primary flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{lang.flag}</div>
                  <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">
                    {lang.nativeLabel}
                  </span>
                  <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lang.englishLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 3. NAVEGAÇÃO & PAINÉIS LATERAIS            */}
      {/* ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              {t("settings.appearance.navigationTitle")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("settings.appearance.navigationDesc")}
            </p>
          </div>
        </div>

        <div className="p-6">
          <label className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                checked={settings.showFolderTree}
                onChange={(e) => handleFolderTreeToggle(e.target.checked)}
                className="w-4.5 h-4.5 text-m3-primary border-slate-300 rounded focus:ring-m3-primary cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-slate-400" />
                {t("settings.appearance.showFolderTree")}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t("settings.appearance.showFolderTreeDesc")}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* ========================================== */}
      {/* 4. DEFINIÇÕES DO STUDIO & ACORDES          */}
      {/* ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layout className="w-5 h-5 text-emerald-500" />
              {t("settings.appearance.studioTitle")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("settings.appearance.studioDesc")}
            </p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
            <Smartphone className="w-3.5 h-3.5" />
            {t("settings.appearance.onDevice")}
          </span>
        </div>

        <div className="p-6">
          <label className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                checked={settings.showChordsDefault}
                onChange={(e) => handleStudioSettingsChange(e.target.checked)}
                className="w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Music2 className="w-4 h-4 text-slate-400" />
                {t("settings.appearance.showChords")}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t("settings.appearance.showChordsDesc")}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. SONG SCORE VISUALIZATION               */}
      {/* ========================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Song Score
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Show a quality score indicator on each song card.
            </p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
            <BarChart2 className="w-3.5 h-3.5" />
            Explorer
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Enable toggle */}
          <label className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                checked={settings.showSongScore}
                onChange={(e) => updateSetting("showSongScore", e.target.checked)}
                className="w-4.5 h-4.5 text-amber-500 border-slate-300 rounded focus:ring-amber-400 cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Star className="w-4 h-4 text-slate-400" />
                Show song score
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Display a completeness score on each song card in the explorer.
              </p>
            </div>
          </label>

          {/* Layout picker — shown only when enabled */}
          {settings.showSongScore && (
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Visualization style
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    {
                      id: "ring" as SongScoreLayout,
                      label: "Ring",
                      desc: "Circular arc around the song icon",
                    },
                    {
                      id: "bar" as SongScoreLayout,
                      label: "Bar",
                      desc: "Thin progress bar below the title",
                    },
                    {
                      id: "dots" as SongScoreLayout,
                      label: "Dots",
                      desc: "Row of five pip indicators",
                    },
                    {
                      id: "badge" as SongScoreLayout,
                      label: "Badge",
                      desc: "Coloured pill chip with the score",
                    },
                  ] as const
                ).map((opt) => {
                  const selected = settings.songScoreLayout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSetting("songScoreLayout", opt.id)}
                      aria-pressed={selected}
                      className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-400/50 ${
                        selected
                          ? "border-amber-400 bg-amber-50/60 dark:bg-amber-400/5 ring-2 ring-amber-400/25 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center shadow-xs">
                          <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                        </div>
                      )}

                      {/* Live mini-preview */}
                      <div className="flex items-center justify-center mb-3 h-10">
                        <SongScoreVisualizer score={74} layout={opt.id} compact />
                      </div>

                      <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">
                        {opt.label}
                      </span>
                      <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
