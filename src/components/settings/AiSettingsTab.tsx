/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiProvider, type AiSettingsPublic } from "@/src/api/ai";
import { Button, Spinner, Surface } from "@/src/components/common";
import { dispatchAiSettingsChanged } from "@/src/features/ai-chat";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import { KeyRound, Loader2, Lock, Save, Sparkles, Trash2 } from "lucide-react";
import { AiMemoryPanel } from "./AiMemoryPanel";
import React, { useEffect, useMemo, useState } from "react";

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

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  openai_compatible: "OpenAI-compatible (custom)",
};

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
      <Surface className="max-w-4xl mx-auto w-full text-center p-8">
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

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <Surface className="p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-title text-m3-text">
              {t("ai.settings.title")}
            </h2>
            <p className="text-muted mt-1 text-sm">{t("ai.settings.desc")}</p>
          </div>
        </div>

        {loading || !settings ? (
          <div className="flex items-center gap-2 text-m3-secondary text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("ai.settings.loading")}
          </div>
        ) : (
          <div className="space-y-5">
            {!settings.encryptionReady && (
              <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-200">
                {t("ai.settings.encryptionMissing")}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-label text-m3-text">
                {t("ai.settings.provider")}
              </span>
              <select
                className={selectClass}
                value={provider}
                onChange={(e) =>
                  handleProviderChange(e.currentTarget.value as AiProvider)
                }
              >
                {(settings.providers ?? []).map((p) => {
                  const cap = settings.nativeWebCapabilities?.[p];
                  const badge =
                    cap?.search || cap?.fetch ? " · web search/fetch" : "";
                  return (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                      {badge}
                    </option>
                  );
                })}
              </select>
              {settings.nativeWebCapabilities?.[provider]?.search ? (
                <span className="text-caption text-m3-secondary block">
                  {t("ai.settings.nativeWebOn")}
                </span>
              ) : (
                <span className="text-caption text-m3-secondary block">
                  {t("ai.settings.nativeWebOff")}
                </span>
              )}
            </label>

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
                  className="text-xs text-m3-primary hover:underline"
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

            <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-m3-border px-3.5 py-3 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-m3-text block">
                  {t("ai.settings.enabled")}
                </span>
                <span className="text-caption text-m3-secondary">
                  {t("ai.settings.enabledDesc")}
                </span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--color-m3-primary)]"
                checked={enabled}
                onChange={(e) => setEnabled(e.currentTarget.checked)}
              />
            </label>

            <div className="space-y-5 pt-5 border-t border-m3-border">
              <div>
                <h3 className="text-label text-m3-text">
                  {t("ai.settings.behaviorTitle")}
                </h3>
                <p className="text-caption text-m3-secondary mt-0.5">
                  {t("ai.settings.behaviorDesc")}
                </p>
              </div>

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
                        className="text-xs text-m3-primary hover:underline"
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
                  onChange={(e) => setMaxOutputTokens(e.currentTarget.value)}
                  placeholder={t("ai.settings.temperatureDefault")}
                />
                <span className="text-caption text-m3-secondary">
                  {t("ai.settings.maxOutputTokensHint")}
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-label text-m3-text">
                  {t("ai.settings.instructions")}
                </span>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
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

              <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-m3-border px-3.5 py-3 cursor-pointer">
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
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-m3-border">
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
        )}
      </Surface>

      {settings && memoryEnabled ? (
        <AiMemoryPanel limits={settings.limits} showToast={showToast} />
      ) : null}
    </div>
  );
};
