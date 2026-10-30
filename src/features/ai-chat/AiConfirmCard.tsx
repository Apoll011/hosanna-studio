/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiConfirmAction } from "@/src/api/ai";
import { useI18n } from "@/src/lib/i18n";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { dispatchLibraryChanged } from "./contextBridge";
import type { AiDestructiveConfirmation } from "./proposals";

type Status = "pending" | "confirming" | "done" | "declined" | "error";

export const AiConfirmCard: React.FC<{
  confirmation: AiDestructiveConfirmation;
}> = ({ confirmation }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (status !== "pending") return;
    setStatus("confirming");
    setError(null);
    try {
      const body: AiConfirmAction = {
        action: confirmation.action,
        id: confirmation.id,
        folderAction: confirmation.folderAction,
      };
      await aiApi.confirmAction(body);
      dispatchLibraryChanged({
        action: confirmation.action,
        id: confirmation.id,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : t("ai.chat.confirmError"));
    }
  };

  const actionLabel = (() => {
    switch (confirmation.action) {
      case "delete_song":
        return t("ai.chat.confirmDeleteSong");
      case "delete_service":
        return t("ai.chat.confirmDeleteService");
      case "delete_folder":
        return t("ai.chat.confirmDeleteFolder");
      case "delete_collection":
        return t("ai.chat.confirmDeleteCollection");
      case "delete_agenda":
        return t("ai.chat.confirmDeleteAgenda");
      default:
        return t("ai.chat.confirm");
    }
  })();

  return (
    <div className="my-1.5 rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/5 overflow-hidden">
      <div className="flex items-start gap-2 px-2.5 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[12px] font-semibold text-m3-text m-0">
            {actionLabel}
          </p>
          <p className="text-[12px] text-m3-text m-0 truncate">
            {confirmation.title}
          </p>
          {confirmation.detail ? (
            <p className="text-[11px] text-m3-secondary m-0">
              {confirmation.detail}
            </p>
          ) : (
            <p className="text-[11px] text-m3-secondary m-0">
              {t("ai.chat.confirmTrashHint")}
            </p>
          )}
          {error ? (
            <p className="text-[11px] text-red-500 m-0">{error}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 pb-2">
        {status === "pending" || status === "error" ? (
          <>
            <button
              type="button"
              onClick={() => void onConfirm()}
              className="text-[11px] px-2.5 py-1 rounded-[var(--radius-md)] bg-m3-danger text-white hover:opacity-90"
            >
              {t("ai.chat.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setStatus("declined")}
              className="text-[11px] px-2.5 py-1 rounded-[var(--radius-md)] border border-m3-border text-m3-text hover:bg-m3-sidebar"
            >
              {t("ai.chat.decline")}
            </button>
          </>
        ) : status === "confirming" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-m3-secondary">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t("ai.chat.confirming")}
          </span>
        ) : status === "done" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <Check className="w-3 h-3" />
            {t("ai.chat.confirmDone")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-m3-secondary">
            <X className="w-3 h-3" />
            {t("ai.chat.confirmDeclined")}
          </span>
        )}
      </div>
    </div>
  );
};
