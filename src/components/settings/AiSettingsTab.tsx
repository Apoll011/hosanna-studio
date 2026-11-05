/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiProvider, type AiSettingsPublic } from "@/src/api/ai";
import { Button, Spinner, Surface } from "@/src/components/common";
import { dispatchAiSettingsChanged } from "@/src/features/ai-chat";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { AiBillingCard } from "./AiBillingCard";
import { AiMemoryPanel } from "./AiMemoryPanel";

export interface AiSettingsTabProps {
  active: boolean;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

const selectClass =
  "w-full rounded-[var(--radius-md)] border border-m3-border bg-m3-card text-m3-text text-sm px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary disabled:opacity-60 disabled:bg-m3-sidebar transition-colors cursor-pointer";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-m3-border bg-m3-card text-m3-text text-sm px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary disabled:opacity-60 disabled:bg-m3-sidebar transition-colors";

const PROVIDER_META: Record<
  AiProvider,
  { label: string; hint: string; accent: string }
> = {
  openai: {
    label: "OpenAI",
    hint: "GPT models",
    accent: "from-emerald-500/15 to-teal-500/5",
  },
  anthropic: {
    label: "Anthropic",
    hint: "Claude",
    accent: "from-amber-500/15 to-orange-500/5",
  },
  google: {
    label: "Gemini",
    hint: "Google AI",
    accent: "from-sky-500/15 to-blue-500/5",
  },
  deepseek: {
    label: "DeepSeek",
    hint: "Search + fetch",
    accent: "from-violet-500/15 to-indigo-500/5",
  },
  openai_compatible: {
    label: "Custom",
    hint: "OpenAI-compatible",
    accent: "from-stone-500/15 to-zinc-500/5",
  },
};

function SectionCard({
  title,
  desc,
  icon,
  action,
  children,
}: {
  title: string;
  desc?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface padding="none" className="overflow-hidden">
      <div className="px-5 py-4 border-b border-m3-border flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-m3-text">{title}</h3>
            {desc ? (
              <p className="text-caption text-m3-secondary mt-0.5">{desc}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </Surface>
  );
}

export const AiSettingsTab: React.FC<AiSettingsTabProps> = ({
  active,
  showToast,
}) => {
  const { t } = useI18n();
  const { granted: canManage, loading: canLoading } = useCan("ai.manage");

  const [settings, setSettings] = useState<AiSettingsPublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [customModel, setCustomModel] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxToolCalls, setMaxToolCalls] = useState(12);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxOutputTokens, setMaxOutputTokens] = useState("");
  const [instructions, setInstructions] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  useEffect(() => {
    if (!active || !canManage) return;
    let cancelled = false;
    setLoading(true);
    void aiApi
      .getSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setProvider(data.provider);
        setModel(data.model);
        setEnabled(data.enabled);
        setBaseUrl(data.baseUrl ?? "");
        setMaxToolCalls(data.maxToolCalls);
        setTemperature(data.temperature);
        setMaxOutputTokens(
          data.maxOutputTokens != null ? String(data.maxOutputTokens) : "",
        );
        setInstructions(data.instructions ?? "");
        setMemoryEnabled(data.memoryEnabled);
        const presets = data.modelPresets[data.provider] ?? [];
        setCustomModel(!presets.includes(data.model));
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : t("ai.settings.loadError");
        showToast?.(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, canManage, showToast, t]);

  const presets = useMemo(
    () => settings?.modelPresets[provider] ?? [],
    [settings, provider],
  );

  if (!active) return null;

  if (canLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-m3-secondary">
        <Spinner size="lg" label={t("ai.settings.loading")} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <Surface className="max-w-xl mx-auto w-full text-center p-10">
        <Lock className="w-8 h-8 text-m3-secondary mx-auto mb-3" />
        <h3 className="text-title text-m3-text">
          {t("ai.settings.noAccessTitle")}
        </h3>
        <p className="text-muted mt-1">{t("ai.settings.noAccessDesc")}</p>
      </Surface>
    );
  }

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const nextPresets = settings?.modelPresets[next] ?? [];
    if (nextPresets.length > 0 && !customModel) {
      setModel(nextPresets[0]!);
    }
    const def = settings?.defaultBaseUrls?.[next];
    if (def) setBaseUrl(def);
    else if (next !== "openai_compatible") setBaseUrl("");
  };

  const needsBaseUrl =
    provider === "openai_compatible" ||
    provider === "deepseek" ||
    provider === "openai";

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await aiApi.updateSettings({
        provider,
        model: model.trim(),
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(needsBaseUrl
          ? { baseUrl: baseUrl.trim() || null }
          : { baseUrl: null }),
        maxToolCalls,
        temperature,
        maxOutputTokens: maxOutputTokens.trim()
          ? Number(maxOutputTokens.trim())
          : null,
        instructions: instructions.trim() || null,
        memoryEnabled,
      });
      setSettings(data);
      setApiKey("");
      setBillingRefreshKey((k) => k + 1);
      dispatchAiSettingsChanged();
      showToast?.(t("ai.settings.saved"), "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("ai.settings.saveError");
      showToast?.(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    setClearing(true);
    try {
      const data = await aiApi.clearKey();
      setSettings(data);
      setEnabled(false);
      dispatchAiSettingsChanged();
      showToast?.(t("ai.settings.keyCleared"), "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("ai.settings.saveError");
      showToast?.(message, "error");
    } finally {
      setClearing(false);
    }
  };

  const providers = settings?.providers ?? [];
  const ready = Boolean(settings?.configured && enabled);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Hero status */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-m3-border bg-m3-card">
        <div className="absolute inset-0 bg-linear-to-br from-m3-primary/10 via-transparent to-m3-sidebar pointer-events-none" />
        <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-m3-primary text-white flex items-center justify-center shrink-0 shadow-[var(--shadow-md)]">
            <Bot className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-title text-m3-text">{t("ai.settings.title")}</h2>
            <p className="text-sm text-m3-secondary mt-1 max-w-xl">
              {t("ai.settings.desc")}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {ready ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-md)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("ai.settings.statusOn")}
                </span>
              ) : settings?.configured ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-md)] bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  <CircleOff className="w-3.5 h-3.5" />
                  {t("ai.settings.statusPaused")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-md)] bg-m3-sidebar text-m3-secondary border border-m3-border">
                  <KeyRound className="w-3.5 h-3.5" />
                  {t("ai.settings.statusSetup")}
                </span>
              )}
              {settings?.configured ? (
                <span className="text-caption text-m3-secondary">
                  {PROVIDER_META[settings.provider]?.label ?? settings.provider}{" "}
                  · {settings.model}
                </span>
              ) : null}
            </div>
          </div>
          {settings ? (
            <label className="flex items-center gap-3 shrink-0 self-start sm:self-center cursor-pointer rounded-[var(--radius-md)] border border-m3-border bg-m3-card/80 px-3.5 py-2.5">
              <span className="text-sm font-medium text-m3-text">
                {t("ai.settings.enabled")}
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--color-m3-primary)]"
                checked={enabled}
                disabled={!settings.configured && !apiKey.trim()}
                onChange={(e) => setEnabled(e.currentTarget.checked)}
              />
            </label>
          ) : null}
        </div>
      </div>

      {loading || !settings ? (
        <div className="flex items-center gap-2 text-m3-secondary text-sm py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("ai.settings.loading")}
        </div>
      ) : (
        <>
          {!settings.encryptionReady && (
            <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              {t("ai.settings.encryptionMissing")}
            </div>
          )}

          <SectionCard
            icon={<Zap className="w-4 h-4" />}
            title={t("ai.settings.connectionTitle")}
            desc={t("ai.settings.connectionDesc")}
          >
            <div>
              <span className="text-label text-m3-text block mb-2">
                {t("ai.settings.provider")}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {providers.map((p) => {
                  const meta = PROVIDER_META[p];
                  const selected = provider === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={`relative text-left rounded-[var(--radius-md)] border p-3 transition-colors cursor-pointer overflow-hidden ${
                        selected
                          ? "border-m3-primary bg-m3-primary/5"
                          : "border-m3-border hover:border-m3-primary/40"
                      }`}
                    >
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${meta.accent} pointer-events-none`}
                      />
                      <div className="relative">
                        <span
                          className={`block text-sm font-semibold ${
                            selected ? "text-m3-primary" : "text-m3-text"
                          }`}
                        >
                          {meta.label}
                        </span>
                        <span className="block text-caption text-m3-secondary mt-0.5">
                          {meta.hint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-caption text-m3-secondary mt-2">
                {settings.nativeWebCapabilities?.[provider]?.search
                  ? t("ai.settings.nativeWebOn")
                  : t("ai.settings.nativeWebOff")}
              </p>
            </div>

            {needsBaseUrl && (
              <label className="block space-y-1.5">
                <span className="text-label text-m3-text">
                  {t("ai.settings.baseUrl")}
                </span>
                <input
                  className={inputClass}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.currentTarget.value)}
                  placeholder={
                    provider === "openai_compatible"
                      ? t("ai.settings.baseUrlRequiredPlaceholder")
                      : t("ai.settings.baseUrlPlaceholder")
                  }
                  required={provider === "openai_compatible"}
                />
                <span className="text-caption text-m3-secondary">
                  {t("ai.settings.baseUrlHint")}
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-m3-text">
                  {t("ai.settings.model")}
                </span>
                <button
                  type="button"
                  className="text-xs text-m3-primary hover:underline cursor-pointer"
                  onClick={() => setCustomModel((v) => !v)}
                >
                  {customModel
                    ? t("ai.settings.usePresets")
                    : t("ai.settings.customModel")}
                </button>
              </div>
              {customModel ? (
                <input
                  className={inputClass}
                  value={model}
                  onChange={(e) => setModel(e.currentTarget.value)}
                  placeholder={t("ai.settings.modelPlaceholder")}
                />
              ) : (
                <select
                  className={selectClass}
                  value={model}
                  onChange={(e) => setModel(e.currentTarget.value)}
                >
                  {presets.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {!presets.includes(model) && model ? (
                    <option value={model}>{model}</option>
                  ) : null}
                </select>
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-label text-m3-text flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5" />
                {t("ai.settings.apiKey")}
              </span>
              <input
                className={inputClass}
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.currentTarget.value)}
                placeholder={
                  settings.configured
                    ? t("ai.settings.apiKeyConfiguredPlaceholder")
                    : t("ai.settings.apiKeyPlaceholder")
                }
              />
              <span className="text-caption text-m3-secondary">
                {settings.configured
                  ? t("ai.settings.keyStatusConfigured")
                  : t("ai.settings.keyStatusMissing")}{" "}
                {t("ai.settings.keyNeverReturned")}
              </span>
            </label>

            {settings.configured &&
            settings.provider === "deepseek" &&
            provider === "deepseek" ? (
              <AiBillingCard
                refreshKey={billingRefreshKey}
                showToast={showToast}
              />
            ) : null}
          </SectionCard>

          <SectionCard
            icon={<Settings2 className="w-4 h-4" />}
            title={t("ai.settings.behaviorTitle")}
            desc={t("ai.settings.behaviorDesc")}
          >
            <label className="block space-y-1.5">
              <span className="text-label text-m3-text">
                {t("ai.settings.instructions")}
              </span>
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                value={instructions}
                maxLength={settings.limits.instructionsMaxChars}
                onChange={(e) => setInstructions(e.currentTarget.value)}
                placeholder={t("ai.settings.instructionsPlaceholder")}
              />
              <span className="text-caption text-m3-secondary flex justify-between gap-2">
                <span>{t("ai.settings.instructionsHint")}</span>
                <span className="tabular-nums shrink-0">
                  {instructions.length}/{settings.limits.instructionsMaxChars}
                </span>
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-m3-border px-3.5 py-3 cursor-pointer hover:bg-m3-sidebar/40 transition-colors">
              <div>
                <span className="text-sm font-medium text-m3-text block">
                  {t("ai.settings.memoryEnabled")}
                </span>
                <span className="text-caption text-m3-secondary">
                  {t("ai.settings.memoryEnabledDesc")}
                </span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--color-m3-primary)]"
                checked={memoryEnabled}
                onChange={(e) => setMemoryEnabled(e.currentTarget.checked)}
              />
            </label>

            <div className="rounded-[var(--radius-md)] border border-m3-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left hover:bg-m3-sidebar/60 transition-colors cursor-pointer"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>
                  <span className="text-sm font-medium text-m3-text block">
                    {t("ai.settings.advanced")}
                  </span>
                  <span className="text-caption text-m3-secondary">
                    {t("ai.settings.advancedDesc")}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-m3-secondary shrink-0 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
              {showAdvanced ? (
                <div className="space-y-5 px-3.5 pb-4 pt-3 border-t border-m3-border bg-m3-sidebar/30">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label text-m3-text">
                        {t("ai.settings.maxToolCalls")}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-m3-primary">
                        {maxToolCalls}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="w-full accent-[var(--color-m3-primary)]"
                      min={settings.limits.maxToolCalls.min}
                      max={settings.limits.maxToolCalls.max}
                      step={1}
                      value={maxToolCalls}
                      onChange={(e) =>
                        setMaxToolCalls(Number(e.currentTarget.value))
                      }
                    />
                    <span className="text-caption text-m3-secondary block">
                      {t("ai.settings.maxToolCallsHint", {
                        min: settings.limits.maxToolCalls.min,
                        max: settings.limits.maxToolCalls.max,
                      })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label text-m3-text">
                        {t("ai.settings.temperature")}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-m3-primary">
                          {temperature == null
                            ? t("ai.settings.temperatureDefault")
                            : temperature.toFixed(1)}
                        </span>
                        {temperature != null ? (
                          <button
                            type="button"
                            className="text-xs text-m3-primary hover:underline cursor-pointer"
                            onClick={() => setTemperature(null)}
                          >
                            {t("ai.settings.temperatureDefault")}
                          </button>
                        ) : null}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="w-full accent-[var(--color-m3-primary)]"
                      min={settings.limits.temperature.min}
                      max={settings.limits.temperature.max}
                      step={0.1}
                      value={temperature ?? 0.7}
                      onChange={(e) =>
                        setTemperature(Number(e.currentTarget.value))
                      }
                    />
                    <span className="text-caption text-m3-secondary block">
                      {t("ai.settings.temperatureHint")}
                    </span>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-label text-m3-text">
                      {t("ai.settings.maxOutputTokens")}
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      inputMode="numeric"
                      min={settings.limits.maxOutputTokens.min}
                      max={settings.limits.maxOutputTokens.max}
                      value={maxOutputTokens}
                      onChange={(e) =>
                        setMaxOutputTokens(e.currentTarget.value)
                      }
                      placeholder={t("ai.settings.temperatureDefault")}
                    />
                    <span className="text-caption text-m3-secondary">
                      {t("ai.settings.maxOutputTokensHint")}
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          </SectionCard>

          {memoryEnabled ? (
            <AiMemoryPanel limits={settings.limits} showToast={showToast} />
          ) : null}

          <div className="sticky bottom-4 z-10">
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius-xl)] border border-m3-border bg-m3-card/95 backdrop-blur-sm px-4 py-3 shadow-[var(--shadow-md)]">
              {settings.configured && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={clearing}
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => void handleClearKey()}
                  disabled={saving}
                >
                  {t("ai.settings.clearKey")}
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                isLoading={saving}
                icon={<Save className="w-4 h-4" />}
                onClick={() => void handleSave()}
                disabled={
                  clearing ||
                  !model.trim() ||
                  (provider === "openai_compatible" && !baseUrl.trim())
                }
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
