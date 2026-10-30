/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiLimits, type AiMemoryItem } from "@/src/api/ai";
import { Button, Surface } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Brain, Loader2, Plus, Sparkles, Trash2, User } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export interface AiMemoryPanelProps {
  limits: AiLimits;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

/** Org-wide notes the assistant remembers (admin CRUD, applied instantly). */
export const AiMemoryPanel: React.FC<AiMemoryPanelProps> = ({
  limits,
  showToast,
}) => {
  const { t } = useI18n();
  const [items, setItems] = useState<AiMemoryItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = useCallback(
    (err: unknown) => {
      showToast?.(
        err instanceof Error ? err.message : t("ai.settings.memoryError"),
        "error",
      );
    },
    [showToast, t],
  );

  useEffect(() => {
    let cancelled = false;
    void aiApi
      .listMemory()
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setItems([]);
          fail(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fail]);

  const add = async () => {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    try {
      const item = await aiApi.addMemory(content);
      setItems((prev) =>
        prev?.some((p) => p.id === item.id) ? prev : [...(prev ?? []), item],
      );
      setDraft("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await aiApi.removeMemory(id);
      setItems((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await aiApi.clearMemory();
      setItems([]);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const count = items?.length ?? 0;
  const full = count >= limits.memoryMaxEntries;

  return (
    <Surface className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-title text-m3-text">
            {t("ai.settings.memoryTitle")}
          </h2>
          <p className="text-muted mt-1 text-sm">
            {t("ai.settings.memoryDesc")}
          </p>
        </div>
        <span className="text-caption text-m3-secondary tabular-nums shrink-0 pt-1">
          {t("ai.settings.memoryCount", {
            count,
            max: limits.memoryMaxEntries,
          })}
        </span>
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-m3-secondary text-sm py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-m3-secondary text-center py-3">
          {t("ai.settings.memoryEmpty")}
        </p>
      ) : (
        <ul className="space-y-1.5 m-0 p-0 list-none">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-start gap-2.5 rounded-[var(--radius-md)] border border-m3-border px-3 py-2"
            >
              <span
                className="mt-0.5 shrink-0 text-m3-secondary"
                title={
                  item.source === "ai"
                    ? t("ai.settings.memorySourceAi")
                    : t("ai.settings.memorySourceAdmin")
                }
              >
                {item.source === "ai" ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </span>
              <span className="flex-1 min-w-0 text-sm text-m3-text break-words">
                {item.content}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(item.id)}
                title={t("ai.settings.memoryDelete")}
                aria-label={t("ai.settings.memoryDelete")}
                className="shrink-0 p-1 rounded-[var(--radius-sm)] text-m3-secondary hover:text-red-600 hover:bg-m3-hover disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-m3-border bg-m3-card text-m3-text text-sm px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary disabled:opacity-60"
          value={draft}
          maxLength={limits.memoryEntryMaxChars}
          disabled={busy || full}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder={t("ai.settings.memoryPlaceholder")}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          disabled={busy || full || !draft.trim()}
        >
          {t("ai.settings.memoryAdd")}
        </Button>
      </form>

      {count > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            icon={<Trash2 className="w-4 h-4" />}
            disabled={busy}
            onClick={() => void clear()}
          >
            {t("ai.settings.memoryClear")}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
};
