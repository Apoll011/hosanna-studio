/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spinner } from "@/src/components/common";
import { useSong } from "@/src/hooks/useSongs";
import { useI18n } from "@/src/lib/i18n";
import { ChordProDiffEditor } from "@hosanna/chordpro/diff";
import { ExternalLink, X } from "lucide-react";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { DIFF_THEME_STYLE, useDiffLabels } from "./proposalDiff";
import { useProposalActions } from "./proposalActions";
import type { SongProposal } from "./proposalStore";

type Props = {
  proposal: SongProposal;
  onClose: () => void;
};

/**
 * Full diff review of a song proposal from anywhere in the app — compares
 * the AI's version against the song as it is right now.
 */
export const AiProposalReview: React.FC<Props> = ({ proposal, onClose }) => {
  const { t } = useI18n();
  const labels = useDiffLabels();
  const { data: song, isLoading } = useSong(proposal.entityId);
  const { applySong, decline, openInEditor } = useProposalActions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    song?.title || proposal.title || t("ai.chat.proposals.untitled");

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-m3-bg/75 backdrop-blur-sm overscroll-contain"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("ai.chat.proposals.reviewTitle", { title })}
        className="flex flex-col w-full max-w-6xl h-[min(88vh,820px)] rounded-[var(--radius-xl)] border border-m3-border bg-m3-card shadow-[var(--shadow-lg)] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-m3-border shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold text-m3-text truncate">
              {t("ai.chat.proposals.reviewTitle", { title })}
            </h2>
            {(proposal.artist || song?.artist) && (
              <p className="m-0 text-[11px] text-m3-secondary truncate">
                {proposal.artist || song?.artist}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={() => {
              onClose();
              openInEditor(proposal);
            }}
          >
            {t("ai.chat.proposals.openEditor")}
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ai.chat.close")}
            className="shrink-0 p-2 rounded-[var(--radius-md)] text-m3-secondary hover:bg-m3-hover hover:text-m3-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Spinner size="md" label={t("ai.chat.proposals.loadingSong")} />
            </div>
          ) : !song ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-m3-secondary">
              {t("ai.chat.proposals.songGone")}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  decline(proposal);
                  onClose();
                }}
              >
                {t("ai.chat.decline")}
              </Button>
            </div>
          ) : (
            <ChordProDiffEditor
              original={song.content}
              modified={proposal.content}
              title={t("ai.chat.proposalTitle")}
              labels={labels}
              style={DIFF_THEME_STYLE}
              autoFocus
              onAccept={async (content) => {
                if (await applySong(proposal, content)) onClose();
              }}
              onReject={() => {
                decline(proposal);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
