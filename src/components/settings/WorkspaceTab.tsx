/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { backupApi } from "@/src/api";
import { Button, Input } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import { Can, CanAny } from "@/src/lib/permissions/components";
import {
  Building2,
  Camera,
  Check,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Lock,
  Palette,
  PenLine,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePrint } from "../../contexts/PrintContext";
import {
  DEFAULT_ORG_SETTINGS,
  OrgPrintSettings,
} from "../../hooks/useOrgSettings";
import { authClient } from "../../lib/authClient";
import { PrintingSettingsCard } from "./PrintingSettingsCard";
import { compressImage } from "./settingsUtils";

export interface WorkspaceTabProps {
  active: boolean;
  showToast: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
  setPendingRestoreData: (data: Record<string, unknown> | null) => void;
  setRestoreStats: (
    stats: { songs: number; folders: number; services: number } | null,
  ) => void;
  setIsTogglingWs?: (toggling: boolean) => void;
}

interface OrgAppearance {
  accentColor: string;
  showBranding: boolean;
}

interface OrgSettings {
  appearance?: OrgAppearance;
  [key: string]: unknown;
}

interface OrgMetadataStructure {
  description?: string;
  shortName?: string;
  settings?: OrgSettings;
  [key: string]: unknown;
}

const DEFAULT_ACCENT_COLOR = "#4f46e5"; // Indigo 600

const PRESET_COLORS = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Azul Oceano", hex: "#0284c7" },
  { name: "Esmeralda", hex: "#059669" },
  { name: "Âmbar", hex: "#d97706" },
  { name: "Rosa", hex: "#e11d48" },
  { name: "Roxo", hex: "#7c3aed" },
  { name: "Ardósia", hex: "#475569" },
];

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
  active,
  showToast,
  setPendingRestoreData,
  setRestoreStats,
}) => {
  const {
    organization,
    organizations,
    refetch: refetchAuth,
    switchOrganization,
  } = useAuth();
  const { t } = useI18n();
  const orgMetadata = (organization?.metadata as OrgMetadataStructure) || {};

  // --- Refs & Async States ---
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  // --- Read-Only / Saved State ---
  const [currentName, setCurrentName] = useState(organization?.name || "");
  const [currentLogo, setCurrentLogo] = useState<string | null | undefined>(
    organization?.logo,
  );
  const [currentDescription, setCurrentDescription] = useState(
    orgMetadata.description || "",
  );
  const [currentShortName, setCurrentShortName] = useState(
    orgMetadata.shortName || "",
  );
  const [currentAppearance, setCurrentAppearance] = useState<OrgAppearance>({
    accentColor:
      orgMetadata.settings?.appearance?.accentColor || DEFAULT_ACCENT_COLOR,
    showBranding: orgMetadata.settings?.appearance?.showBranding ?? true,
  });

  const { printSong } = usePrint();
  const rawPrintSettings =
    (orgMetadata.settings?.print as Partial<OrgPrintSettings>) || {};
  const [currentPrintSettings, setCurrentPrintSettings] =
    useState<OrgPrintSettings>({
      templateFamily:
        rawPrintSettings.templateFamily ||
        DEFAULT_ORG_SETTINGS.print.templateFamily,
      showChords:
        rawPrintSettings.showChords ?? DEFAULT_ORG_SETTINGS.print.showChords,
      twoColumnLayout:
        rawPrintSettings.twoColumnLayout ??
        DEFAULT_ORG_SETTINGS.print.twoColumnLayout,
      fontSize:
        rawPrintSettings.fontSize ?? DEFAULT_ORG_SETTINGS.print.fontSize,
      showChurchHeader:
        rawPrintSettings.showChurchHeader ??
        DEFAULT_ORG_SETTINGS.print.showChurchHeader,
      showChurchLogo:
        rawPrintSettings.showChurchLogo ??
        DEFAULT_ORG_SETTINGS.print.showChurchLogo,
      showMetadata:
        rawPrintSettings.showMetadata ??
        DEFAULT_ORG_SETTINGS.print.showMetadata,
      pageBreakBetweenItems:
        rawPrintSettings.pageBreakBetweenItems ??
        DEFAULT_ORG_SETTINGS.print.pageBreakBetweenItems,
      customFooter:
        rawPrintSettings.customFooter ??
        DEFAULT_ORG_SETTINGS.print.customFooter,
    });

  // --- Draft State (Edit Mode) ---
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(currentName);
  const [draftLogo, setDraftLogo] = useState<string | null | undefined>(
    currentLogo,
  );
  const [draftDescription, setDraftDescription] = useState(currentDescription);
  const [draftShortName, setDraftShortName] = useState(currentShortName);
  const [draftAppearance, setDraftAppearance] =
    useState<OrgAppearance>(currentAppearance);
  const [draftPrintSettings, setDraftPrintSettings] =
    useState<OrgPrintSettings>(currentPrintSettings);

  // --- Permissions ---
  const { granted: canManageOrg, loading: canLoading } = useCan(
    "organization.update",
  );

  // Sync state when organization auth context changes
  useEffect(() => {
    if (organization) {
      const meta = (organization.metadata as OrgMetadataStructure) || {};
      const name = organization.name || "";
      const logo = organization.logo || null;
      const desc = meta.description || "";
      const short = meta.shortName || "";
      const appearance: OrgAppearance = {
        accentColor:
          meta.settings?.appearance?.accentColor || DEFAULT_ACCENT_COLOR,
        showBranding: meta.settings?.appearance?.showBranding ?? true,
      };
      const rawPrint =
        (meta.settings?.print as Partial<OrgPrintSettings>) || {};
      const parsedPrint: OrgPrintSettings = {
        templateFamily:
          rawPrint.templateFamily || DEFAULT_ORG_SETTINGS.print.templateFamily,
        showChords:
          rawPrint.showChords ?? DEFAULT_ORG_SETTINGS.print.showChords,
        twoColumnLayout:
          rawPrint.twoColumnLayout ??
          DEFAULT_ORG_SETTINGS.print.twoColumnLayout,
        fontSize: rawPrint.fontSize ?? DEFAULT_ORG_SETTINGS.print.fontSize,
        showChurchHeader:
          rawPrint.showChurchHeader ??
          DEFAULT_ORG_SETTINGS.print.showChurchHeader,
        showChurchLogo:
          rawPrint.showChurchLogo ?? DEFAULT_ORG_SETTINGS.print.showChurchLogo,
        showMetadata:
          rawPrint.showMetadata ?? DEFAULT_ORG_SETTINGS.print.showMetadata,
        pageBreakBetweenItems:
          rawPrint.pageBreakBetweenItems ??
          DEFAULT_ORG_SETTINGS.print.pageBreakBetweenItems,
        customFooter:
          rawPrint.customFooter ?? DEFAULT_ORG_SETTINGS.print.customFooter,
      };

      setCurrentName(name);
      setCurrentLogo(logo);
      setCurrentDescription(desc);
      setCurrentShortName(short);
      setCurrentAppearance(appearance);
      setCurrentPrintSettings(parsedPrint);

      if (!isEditing) {
        setDraftName(name);
        setDraftLogo(logo);
        setDraftDescription(desc);
        setDraftShortName(short);
        setDraftAppearance(appearance);
        setDraftPrintSettings(parsedPrint);
      }
    }
  }, [organization, isEditing]);

  if (!active) return null;

  // --- Handlers ---
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(t("settings.account.profile.invalidImage"), "error");
      return;
    }

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 800, 0.85);
      setDraftLogo(compressedBase64);
      showToast(t("settings.workspace.imageProcessed"), "info");
    } catch {
      showToast(t("settings.workspace.imageProcessError"), "error");
    } finally {
      setIsCompressing(false);
      e.target.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setDraftLogo(null);
  };

  const handleSaveOrganization = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!draftName.trim()) {
      showToast(t("settings.workspace.nameRequired"), "error");
      return;
    }

    // Backup state for rollback
    const prev = {
      name: currentName,
      logo: currentLogo,
      desc: currentDescription,
      short: currentShortName,
      appearance: currentAppearance,
      print: currentPrintSettings,
    };

    // Optimistic UI updates
    setCurrentName(draftName.trim());
    setCurrentLogo(draftLogo);
    setCurrentDescription(draftDescription.trim());
    setCurrentShortName(draftShortName.trim());
    setCurrentAppearance(draftAppearance);
    setCurrentPrintSettings(draftPrintSettings);
    setIsEditing(false);

    try {
      setIsSavingOrganization(true);
      const updatedMetadata: OrgMetadataStructure = {
        ...orgMetadata,
        description: draftDescription.trim() || undefined,
        shortName: draftShortName.trim() || undefined,
        settings: {
          ...orgMetadata.settings,
          appearance: {
            accentColor: draftAppearance.accentColor || DEFAULT_ACCENT_COLOR,
            showBranding: draftAppearance.showBranding,
          },
          print: draftPrintSettings,
        },
      };

      await authClient.organization.update({
        data: {
          name: draftName.trim(),
          logo: draftLogo || undefined,
          metadata: updatedMetadata,
        },
      });

      await refetchAuth();
      showToast(t("settings.workspace.saved"), "success");
    } catch (err) {
      // Rollback on failure
      setCurrentName(prev.name);
      setCurrentLogo(prev.logo);
      setCurrentDescription(prev.desc);
      setCurrentShortName(prev.short);
      setCurrentAppearance(prev.appearance);
      setCurrentPrintSettings(prev.print);

      setDraftName(prev.name);
      setDraftLogo(prev.logo);
      setDraftDescription(prev.desc);
      setDraftShortName(prev.short);
      setDraftAppearance(prev.appearance);
      setDraftPrintSettings(prev.print);
      setIsEditing(true);

      showToast(
        t("settings.workspace.saveError", {
          error: (err as { message?: string })?.message || "Erro de rede",
        }),
        "error",
      );
    } finally {
      setIsSavingOrganization(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftName(currentName);
    setDraftLogo(currentLogo);
    setDraftDescription(currentDescription);
    setDraftShortName(currentShortName);
    setDraftAppearance(currentAppearance);
    setDraftPrintSettings(currentPrintSettings);
    setIsEditing(false);
  };

  const handleTestPrint = () => {
    const activeOpts = isEditing ? draftPrintSettings : currentPrintSettings;
    printSong(
      {
        id: "sample-song-demo",
        title: "Quão Grande és Tu",
        artist: "Carl Boberg",
        content: `{title: Quão Grande és Tu}\n{artist: Carl Boberg}\n{key: G}\n{tempo: 72}\n{time: 4/4}\n{capo: 0}\n{ccli: 4672}\n\n{c: Verso 1}\n[G]Senhor meu Deus, quando eu mara[C]vilhado\n[G]Fico a pensar nas [D]obras de Tuas [G]mãos\n[G]O céu azul de estrelas pon[C]tilhado\n[G]Mostrando a glória [D]do Teu grande a[G]mor\n\n{c: Coro}\n[D]Então minha alma [G]canta a Ti, Se[C]nhor\nQuão grande és [G]Tu! Quão grande és [D]Tu!\n[D]Então minha alma [G]canta a Ti, Se[C]nhor\nQuão grande és [G]Tu! [D]Quão grande és [G]Tu!\n\n{c: Verso 2}\n[G]Quando eu contemplo a cruz daquela es[C]trada\n[G]Onde Jesus por [D]mim ali mor[G]reu\n[G]Meu coração se rende à graça a[C]mada\n[G]E a redenção que [D]o Pai me conce[G]deu`,
        path: "Hinos/Quão Grande és Tu.pro",
        tags: ["Hinos", "Louvor"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeOpts,
    );
  };

  const handleSwitchWorkspace = async (org: (typeof organizations)[number]) => {
    if (switchingOrgId) return;
    setSwitchingOrgId(org.id);
    try {
      // On success this hard-navigates to the new workspace.
      await switchOrganization(org);
    } catch (err) {
      showToast(
        t("settings.workspace.switchOrgError", {
          error: (err as { message?: string })?.message || "",
        }),
        "error",
      );
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleBackup = async () => {
    setIsDownloading(true);
    try {
      await backupApi.downloadBackup();
      showToast(t("settings.workspace.exportSuccess"), "success");
    } catch {
      showToast(t("settings.workspace.exportError"), "error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPendingRestoreData(json);
        setRestoreStats({
          songs: json.songs?.length || 0,
          services: json.services?.length || 0,
          folders: json.folders?.length || 0,
        });
      } catch {
        showToast(t("settings.workspace.invalidJson"), "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const displayLogo = isEditing ? draftLogo : currentLogo;
  const displayAccentColor = isEditing
    ? draftAppearance.accentColor
    : currentAppearance.accentColor;
  const displayShowBranding = isEditing
    ? draftAppearance.showBranding
    : currentAppearance.showBranding;

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ========================================== */}
      {/* 1. PERFIL E IDENTIDADE DA ORGANIZAÇÃO      */}
      {/* ========================================== */}
      <form id="org-main-form" onSubmit={handleSaveOrganization}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
          {/* Card Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-m3-primary" />
                {t("settings.workspace.title")}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("settings.workspace.desc")}
              </p>
            </div>

            {!canLoading && !canManageOrg && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                {t("settings.general.readOnly")}
              </span>
            )}
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-8">
            {/* Secção Superior: Logótipo + Dados Básicos */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Logo Upload Box */}
              <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                <div className="relative group w-32 h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                  {displayLogo ? (
                    <img
                      src={displayLogo}
                      alt="Logo da Organização"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <ImagePlus className="w-10 h-10 mb-1 opacity-70" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">
                        {t("settings.workspace.noLogo")}
                      </span>
                    </div>
                  )}

                  {/* Edit/Hover Overlay */}
                  {isEditing && canManageOrg && (
                    <label className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-xs">
                      {isCompressing ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-white mb-1.5" />
                          <span className="text-[11px] font-semibold text-white uppercase tracking-wider">
                            {displayLogo
                              ? t("settings.workspace.change")
                              : t("settings.workspace.add")}
                          </span>
                        </>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        disabled={isCompressing || isSavingOrganization}
                      />
                    </label>
                  )}
                </div>

                {isEditing && canManageOrg && (
                  <div className="flex flex-col items-center gap-1.5">
                    {displayLogo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("settings.workspace.removeLogo")}
                      </button>
                    )}
                    <p className="text-[11px] text-slate-400 text-center max-w-32">
                      {t("settings.workspace.logoSpecs")}
                    </p>
                  </div>
                )}
              </div>

              {/* Informações Textuais */}
              <div className="flex-1 w-full space-y-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Input
                        label={t("settings.workspace.orgNameLabel")}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder={t("settings.workspace.orgNamePlaceholder")}
                        required
                        disabled={isSavingOrganization}
                      />
                    </div>
                    <div>
                      <Input
                        label={t("settings.workspace.shortNameLabel")}
                        value={draftShortName}
                        onChange={(e) => setDraftShortName(e.target.value)}
                        placeholder={t(
                          "settings.workspace.shortNamePlaceholder",
                        )}
                        disabled={isSavingOrganization}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                        {t("settings.workspace.descriptionLabel")}
                      </label>
                      <textarea
                        rows={3}
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder={t(
                          "settings.workspace.descriptionPlaceholder",
                        )}
                        disabled={isSavingOrganization}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-m3-primary/30 focus:border-m3-primary transition-all resize-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {currentName || t("settings.workspace.defaultOrgName")}
                      </h3>
                      {currentShortName && (
                        <span className="text-xs font-bold text-m3-primary bg-m3-primary/10 border border-m3-primary/20 px-2.5 py-0.5 rounded-md">
                          {currentShortName}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                      {currentDescription || (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          {t("settings.workspace.noDescription")}
                        </span>
                      )}
                    </p>

                    {/* Metadata Specs Pills */}
                    <div className="pt-2 flex flex-wrap gap-4 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-700 flex items-center gap-2">
                        <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                          ID:
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {organization?.id || "—"}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-700 flex items-center gap-2">
                        <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                          Slug:
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {organization?.slug || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Separador */}
            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Secção de Identidade Visual e Cores */}
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide">
                  <Palette className="w-4 h-4 text-rose-500" />
                  {t("settings.workspace.visualIdentityTitle")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("settings.workspace.visualIdentityDesc")}
                </p>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-700">
                  {/* Cor de Destaque */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block">
                      {t("settings.workspace.accentColorLabel")}
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <input
                          type="color"
                          disabled={isSavingOrganization}
                          value={draftAppearance.accentColor}
                          onChange={(e) =>
                            setDraftAppearance({
                              ...draftAppearance,
                              accentColor: e.target.value,
                            })
                          }
                          className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 bg-transparent overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-xl disabled:opacity-50"
                        />
                        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-300 dark:ring-slate-600 pointer-events-none" />
                      </div>

                      <div className="flex-1">
                        <Input
                          disabled={isSavingOrganization}
                          value={draftAppearance.accentColor}
                          onChange={(e) =>
                            setDraftAppearance({
                              ...draftAppearance,
                              accentColor: e.target.value,
                            })
                          }
                          placeholder="#4F46E5"
                          className="font-mono uppercase text-sm"
                        />
                      </div>
                    </div>

                    {/* Predefinições Rápidas */}
                    <div className="pt-1">
                      <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
                        {t("settings.workspace.quickColors")}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset.hex}
                            type="button"
                            disabled={isSavingOrganization}
                            onClick={() =>
                              setDraftAppearance({
                                ...draftAppearance,
                                accentColor: preset.hex,
                              })
                            }
                            title={preset.name}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                              draftAppearance.accentColor.toLowerCase() ===
                              preset.hex.toLowerCase()
                                ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900"
                                : ""
                            }`}
                            style={{ backgroundColor: preset.hex }}
                          >
                            {draftAppearance.accentColor.toLowerCase() ===
                              preset.hex.toLowerCase() && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Toggle de Marca & Live Preview */}
                  <div className="flex flex-col justify-between space-y-4">
                    <label
                      className={`flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl transition-all ${
                        !isSavingOrganization
                          ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-600"
                          : "opacity-70 cursor-not-allowed"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isSavingOrganization}
                        checked={draftAppearance.showBranding}
                        onChange={(e) =>
                          setDraftAppearance({
                            ...draftAppearance,
                            showBranding: e.target.checked,
                          })
                        }
                        className="w-4 h-4 mt-0.5 rounded text-m3-primary border-slate-300 focus:ring-m3-primary cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          {t("settings.workspace.showBrandingLabel")}
                        </span>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {t("settings.workspace.showBrandingDesc")}
                        </p>
                      </div>
                    </label>

                    {/* Preview Box */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        {t("settings.workspace.preview")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-md text-white font-medium text-[11px] shadow-xs"
                          style={{
                            backgroundColor: draftAppearance.accentColor,
                          }}
                        >
                          {t("settings.workspace.activeButton")}
                        </span>
                        {draftAppearance.showBranding && (
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                            {draftShortName ||
                              draftName ||
                              t("settings.workspace.churchFallback")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Modo Visualização de Identidade */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div
                      className="w-10 h-10 rounded-xl border border-white/20 shadow-xs shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: displayAccentColor }}
                    >
                      <Palette className="w-5 h-5 text-white drop-shadow-xs" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider block">
                        {t("settings.workspace.accentColorTitle")}
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                        {displayAccentColor.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        displayShowBranding
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider block">
                        {t("settings.workspace.brandingTitle")}
                      </span>
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {displayShowBranding
                          ? t("settings.workspace.brandingActive")
                          : t("settings.workspace.brandingHidden")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Secção 3: Modelos & Impressão */}
            <PrintingSettingsCard
              isEditing={isEditing}
              settings={isEditing ? draftPrintSettings : currentPrintSettings}
              onUpdate={setDraftPrintSettings}
              canManageOrg={canManageOrg}
              onTestPrint={handleTestPrint}
            />
          </div>

          {/* Card Footer (Actions) */}
          {canManageOrg && (
            <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-3">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSavingOrganization}
                    icon={<RotateCcw className="w-4 h-4" />}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSavingOrganization}
                    icon={
                      isSavingOrganization ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )
                    }
                  >
                    {isSavingOrganization
                      ? t("settings.workspace.saving")
                      : t("settings.workspace.saveChanges")}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  icon={<PenLine className="w-4 h-4" />}
                >
                  {t("settings.workspace.editProfile")}
                </Button>
              )}
            </div>
          )}
        </div>
      </form>

      {/* ========================================== */}
      {/* 2. CÓPIAS DE SEGURANÇA & DADOS             */}
      {/* ========================================== */}
      <CanAny permissions={["backup.export", "backup.import"]}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-500" />
              {t("settings.workspace.backupTitle")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("settings.workspace.backupDesc")}
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Area */}
              <Can permission="backup.export">
                <div className="flex flex-col p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-m3-bg justify-between">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="p-2.5 bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-xl shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {t("settings.workspace.exportData")}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("settings.workspace.exportDesc")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={handleBackup}
                    disabled={isDownloading}
                    icon={
                      isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                      ) : (
                        <Download className="w-4 h-4 text-sky-500" />
                      )
                    }
                  >
                    {isDownloading
                      ? t("settings.workspace.exportProcessing")
                      : t("settings.workspace.exportDownloadBtn")}
                  </Button>
                </div>
              </Can>

              {/* Import Area */}
              <Can permission="backup.import">
                <div className="flex flex-col p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-m3-bg justify-between">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {t("settings.workspace.restoreData")}
                      </h4>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        {t("settings.workspace.restoreWarning")}
                      </p>
                    </div>
                  </div>

                  <input
                    ref={restoreInputRef}
                    type="file"
                    accept=".hosanna"
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => restoreInputRef.current?.click()}
                    icon={<Upload className="w-4 h-4 text-emerald-500" />}
                  >
                    {t("settings.workspace.restoreUploadBtn")}
                  </Button>
                </div>
              </Can>
            </div>
          </div>
        </div>
      </CanAny>
      {organizations.length > 1 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-m3-primary" />
              {t("settings.workspace.switchOrgTitle")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("settings.workspace.switchOrgDesc")}
            </p>
          </div>
          <div className="p-6">
            <ul className="space-y-2.5">
              {organizations.map((org) => {
                const isCurrent = org.id === organization?.id;
                return (
                  <li
                    key={org.id}
                    className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-colors ${
                      isCurrent
                        ? "border-m3-primary/30 bg-m3-primary/4 dark:bg-m3-primary/10"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden flex items-center justify-center bg-m3-primary/10 border border-m3-border/60 text-sm font-black text-m3-primary">
                        {org.logo ? (
                          <img
                            src={org.logo}
                            alt={org.name || ""}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (org.name?.trim().charAt(0) || "·").toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {org.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                          @{org.slug}
                        </p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                        <Check className="w-3 h-3" />
                        {t("settings.workspace.currentOrg")}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={switchingOrgId !== null}
                        icon={
                          switchingOrgId === org.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : undefined
                        }
                        onClick={() => handleSwitchWorkspace(org)}
                      >
                        {switchingOrgId === org.id
                          ? t("settings.workspace.switchingOrg")
                          : t("settings.workspace.switchOrg")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
};
