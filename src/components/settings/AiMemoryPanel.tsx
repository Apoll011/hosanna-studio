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
    <Surface className="p-6 space-y-5">
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
        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-1">
          <span className="text-caption text-m3-secondary tabular-nums">
            {t("ai.settings.memoryCount", {
              count,
              max: limits.memoryMaxEntries,
            })}
          </span>
          <span className="block w-20 h-1 rounded-full bg-m3-border overflow-hidden">
            <span
              className={`block h-full rounded-full transition-all ${full ? "bg-amber-500" : "bg-m3-primary"}`}
              style={{
                width: `${Math.min(100, (count / limits.memoryMaxEntries) * 100)}%`,
              }}
            />
          </span>
        </div>
      </div>

      <form
        className="flex items-center gap-2"
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
          className="shrink-0"
          icon={<Plus className="w-4 h-4" />}
          disabled={busy || full || !draft.trim()}
        >
          {t("ai.settings.memoryAdd")}
        </Button>
      </form>

      {items === null ? (
        <div className="flex items-center justify-center py-6 text-m3-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-m3-border py-8 px-4 text-center">
          <Brain className="w-6 h-6 text-m3-secondary/60" />
          <p className="text-sm text-m3-secondary max-w-sm m-0">
            {t("ai.settings.memoryEmpty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="m-0 p-0 list-none rounded-[var(--radius-md)] border border-m3-border divide-y divide-m3-border overflow-hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-3.5 py-2.5 bg-m3-card hover:bg-m3-sidebar/50 transition-colors"
              >
                <span
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    item.source === "ai"
                      ? "bg-m3-primary/10 text-m3-primary"
                      : "bg-m3-sidebar text-m3-secondary"
                  }`}
                  title={
                    item.source === "ai"
                      ? t("ai.settings.memorySourceAi")
                      : t("ai.settings.memorySourceAdmin")
                  }
                >
                  {item.source === "ai" ? (
                    <Sparkles className="w-3 h-3" />
                  ) : (
                    <User className="w-3 h-3" />
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
                  className="shrink-0 p-1.5 rounded-[var(--radius-sm)] text-m3-secondary opacity-60 group-hover:opacity-100 hover:text-red-600 hover:bg-red-500/10 focus-visible:opacity-100 disabled:opacity-40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void clear()}
              className="text-xs text-m3-secondary hover:text-red-600 hover:underline disabled:opacity-50"
            >
              {t("ai.settings.memoryClear")}
            </button>
          </div>
        </div>
      )}
    </Surface>
  );
};
