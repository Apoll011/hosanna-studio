/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Music,
  Sparkles,
  X,
} from "lucide-react";
import React, { useCallback, useState, useSyncExternalStore } from "react";
import { aiContextBridge } from "./contextBridge";
import { AiProposalReview } from "./AiProposalReview";
import { useProposalActions } from "./proposalActions";
import {
  aiProposals,
  useAiProposals,
  type AiProposal,
  type SongProposal,
} from "./proposalStore";

/** Key of the editor currently open (`song:<id>` / `service:<id>`), if any. */
function openEditorKey(): string {
  const song = aiContextBridge.getSong();
  if (song) return `song:${song.songId}`;
  const service = aiContextBridge.getService();
  if (service) return `service:${service.serviceId}`;
  return "";
}

function useOpenEditorKey(): string {
  return useSyncExternalStore(
    aiContextBridge.subscribe,
    openEditorKey,
    openEditorKey,
  );
}

const iconBtn =
  "inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text disabled:opacity-50 transition-colors";

/**
 * Every AI edit waiting for a decision, reviewable from any page. This is
 * what makes proposals independent of which screen the user is on.
 */
export const AiProposalTray: React.FC = () => {
  const { t, tc } = useI18n();
  const proposals = useAiProposals();
  const openKey = useOpenEditorKey();
  const { granted: canUpdateSong } = useCan("song.update");
  const { applySong, decline, openInEditor } = useProposalActions();
  const [expanded, setExpanded] = useState(true);
  const [reviewing, setReviewing] = useState<SongProposal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const accept = useCallback(
    async (p: SongProposal) => {
      setBusy(p.key);
      try {
        await applySong(p);
      } finally {
        setBusy(null);
      }
    },
    [applySong],
  );

  const acceptAll = useCallback(async () => {
    const targets = proposals.filter(
      (p): p is SongProposal => p.kind === "song" && p.key !== openKey,
    );
    setBusy("*");
    try {
      for (const p of targets) await applySong(p);
    } finally {
      setBusy(null);
    }
  }, [proposals, openKey, applySong]);

  if (proposals.length === 0) return null;

  const acceptable = proposals.filter(
    (p) => p.kind === "song" && p.key !== openKey,
  ).length;

  const rowTitle = (p: AiProposal) =>
    p.kind === "song"
      ? p.title || t("ai.chat.proposals.untitled")
      : p.name || t("ai.chat.proposals.untitled");

  return (
    <section
      className="shrink-0 border-b border-m3-border bg-m3-primary/5"
      aria-label={t("ai.chat.proposalTitle")}
    >
      <div className="flex items-center gap-1.5 pl-3 pr-2 py-1.5">
        <button
          type="button"
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={
            expanded
              ? t("ai.chat.proposals.collapse")
              : t("ai.chat.proposals.expand")
          }
        >
          <Sparkles className="w-3.5 h-3.5 text-m3-primary shrink-0" />
          <span className="text-xs font-semibold text-m3-text truncate">
            {tc("ai.chat.proposals.pending", proposals.length)}
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-m3-secondary shrink-0" />
          )}
        </button>
        {canUpdateSong && acceptable > 1 && (
          <button
            type="button"
            className="text-[11px] font-medium text-m3-primary hover:underline px-1.5 py-1 disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void acceptAll()}
          >
            {t("ai.chat.proposals.acceptAll")}
          </button>
        )}
        {proposals.length > 1 && (
          <button
            type="button"
            className="text-[11px] font-medium text-m3-secondary hover:text-m3-text hover:underline px-1.5 py-1 disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => aiProposals.resolveAll()}
          >
            {t("ai.chat.proposals.declineAll")}
          </button>
        )}
      </div>

      {expanded && (
        <ul className="m-0 p-0 list-none max-h-52 overflow-y-auto custom-scrollbar px-2 pb-2 space-y-1">
          {proposals.map((p) => {
            const inEditor = p.key === openKey;
            const Icon = p.kind === "song" ? Music : CalendarDays;
            return (
              <li
                key={p.key}
                className="logos-msg-in flex items-center gap-2 rounded-[var(--radius-md)] border border-m3-border bg-m3-card px-2 py-1.5"
              >
                <Icon className="w-3.5 h-3.5 text-m3-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-xs font-medium text-m3-text truncate">
                    {rowTitle(p)}
                  </p>
                  <p className="m-0 text-[10.5px] text-m3-secondary truncate">
                    {inEditor
                      ? t("ai.chat.proposals.inEditor")
                      : p.kind === "song"
                        ? p.artist || t("ai.chat.proposals.songKind")
                        : t("ai.chat.proposals.serviceKind")}
                  </p>
                </div>

                {p.kind === "song" && !inEditor && canUpdateSong && (
                  <>
                    <button
                      type="button"
                      className={iconBtn}
                      title={t("ai.chat.proposals.review")}
                      aria-label={t("ai.chat.proposals.review")}
                      onClick={() => setReviewing(p)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} !text-m3-success hover:!bg-m3-success/10`}
                      title={t("ai.chat.accept")}
                      aria-label={t("ai.chat.accept")}
                      disabled={busy !== null}
                      onClick={() => void accept(p)}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {(p.kind === "service" || inEditor) && (
                  <button
                    type="button"
                    className={iconBtn}
                    title={t("ai.chat.proposals.openEditor")}
                    aria-label={t("ai.chat.proposals.openEditor")}
                    onClick={() => openInEditor(p)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className={iconBtn}
                  title={t("ai.chat.decline")}
                  aria-label={t("ai.chat.decline")}
                  disabled={busy !== null}
                  onClick={() => decline(p)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {reviewing && (
        <AiProposalReview
          proposal={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </section>
  );
};
