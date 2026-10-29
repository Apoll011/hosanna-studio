/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  aiApi,
  type AiProvider,
  type AiSettingsPublic,
} from "@/src/api/ai";
import { Button, Spinner, Surface } from "@/src/components/common";
import { dispatchAiSettingsChanged } from "@/src/features/ai-chat";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import {
  KeyRound,
  Loader2,
  Lock,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
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
        <h3 className="text-title text-m3-text">{t("ai.settings.noAccessTitle")}</h3>
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
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await aiApi.updateSettings({
        provider,
        model: model.trim(),
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
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
            <h2 className="text-title text-m3-text">{t("ai.settings.title")}</h2>
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
                {(settings.providers ?? []).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>

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
                disabled={clearing || !model.trim()}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
};
