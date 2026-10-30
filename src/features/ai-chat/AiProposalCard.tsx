/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { useSong } from "@/src/hooks/useSongs";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import {
  buildItems,
  computeDiff,
  segmentLine,
  type DiffLine,
} from "@hosanna/chordpro/diff";
import {
  Check,
  ChevronsUpDown,
  CircleSlash,
  ExternalLink,
  Maximize2,
  Music,
  X,
} from "lucide-react";
import React, { memo, useMemo, useState } from "react";
import { AiProposalReview } from "./AiProposalReview";
import { useProposalActions } from "./proposalActions";
import {
  useSongProposal,
  useSongProposalStatus,
  type SongProposal,
} from "./proposalStore";
import { useOpenEditorKey } from "./useOpenEditorKey";

export type AiSongProposalPayload = {
  id: string;
  content: string;
  title?: string;
  artist?: string;
};

const ROW_TONE: Record<DiffLine["type"], string> = {
  equal: "",
  insert: "bg-m3-success/10",
  delete: "bg-m3-danger/10",
};
const MARK_TONE: Record<DiffLine["type"], string> = {
  equal: "",
  insert: "bg-m3-success/30",
  delete: "bg-m3-danger/30",
};

/** Compact unified diff sized for the chat column. */
const MiniDiff: React.FC<{ original: string; modified: string }> = ({
  original,
  modified,
}) => {
  const { t } = useI18n();
  const diff = useMemo(
    () => computeDiff(original, modified),
    [original, modified],
  );
  const items = useMemo(() => buildItems(diff, 1), [diff]);

  if (diff.identical) {
    return (
      <p className="m-0 px-3 py-2 text-[11.5px] text-m3-secondary">
        {t("ai.chat.diff.noChanges")}
      </p>
    );
  }

  return (
    <div className="max-h-64 overflow-auto custom-scrollbar font-mono text-[11px] leading-[1.55]">
      {items.map((item, i) => {
        if (item.kind === "fold") {
          return (
            <div
              key={`f${i}`}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-m3-primary/5 text-m3-primary text-[10.5px] font-sans"
            >
              <ChevronsUpDown className="w-3 h-3" />
              {t("ai.chat.diff.unchangedLines", { n: item.lines.length })}
            </div>
          );
        }
        const { line } = item;
        return (
          <div
            key={`l${i}`}
            className={`flex ${ROW_TONE[line.type]} ${
              line.type === "equal" ? "text-m3-secondary" : "text-m3-text"
            }`}
          >
            <span
              aria-hidden
              className={`w-5 shrink-0 text-center select-none ${
                line.type === "insert"
                  ? "text-m3-success"
                  : line.type === "delete"
                    ? "text-m3-danger"
                    : ""
              }`}
            >
              {line.type === "insert" ? "+" : line.type === "delete" ? "−" : ""}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-2">
              {line.text === ""
                ? "\u00a0"
                : segmentLine(line.text, line.ranges).map((seg, j) => (
                    <span
                      key={j}
                      className={[
                        seg.syntax === "chord"
                          ? "text-m3-primary font-semibold"
                          : "",
                        seg.syntax === "directive" ? "text-m3-secondary" : "",
                        seg.syntax === "comment" ? "text-m3-input italic" : "",
                        seg.changed
                          ? `${MARK_TONE[line.type]} rounded-[2px]`
                          : "",
                      ].join(" ")}
                    >
                      {seg.text}
                    </span>
                  ))}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * An AI song edit, right in the chat. When the song isn't open in the editor
 * you can read the diff and accept or decline the whole proposal here; when
 * it is open, the full diff is already in the editor.
 */
export const AiProposalCard: React.FC<{ proposal: AiSongProposalPayload }> =
  memo(function AiProposalCard({ proposal }) {
    const { t } = useI18n();
    const { granted: canUpdate } = useCan("song.update");
    const status = useSongProposalStatus(proposal.id, proposal.content);
    const stored = useSongProposal(proposal.id);
    const openKey = useOpenEditorKey();
    const { data: song, isLoading } = useSong(
      status === "pending" ? proposal.id : null,
    );
    const { applySong, decline, openInEditor } = useProposalActions();
    const [busy, setBusy] = useState(false);
    const [review, setReview] = useState<SongProposal | null>(null);

    const inEditor = openKey === `song:${proposal.id}`;
    const title =
      proposal.title || song?.title || t("ai.chat.proposals.untitled");
    const live: SongProposal | null =
      stored && stored.content === proposal.content ? stored : null;

    const stats = useMemo(() => {
      if (!song) return null;
      const d = computeDiff(song.content, proposal.content);
      return d.stats;
    }, [song, proposal.content]);

    const accept = async () => {
      if (!live) return;
      setBusy(true);
      try {
        await applySong(live);
      } finally {
        setBusy(false);
      }
    };

    const statusLine =
      status === "accepted"
        ? {
            icon: Check,
            text: t("ai.chat.proposals.statusApplied"),
            tone: "text-m3-success",
          }
        : status === "declined"
          ? {
              icon: X,
              text: t("ai.chat.proposals.statusDeclined"),
              tone: "text-m3-secondary",
            }
          : {
              icon: CircleSlash,
              text: t("ai.chat.proposals.statusStale"),
              tone: "text-m3-secondary",
            };

    return (
      <div className="logos-msg-in mt-1.5 rounded-[var(--radius-lg)] border border-m3-primary/30 bg-m3-card overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-m3-border/70">
          <Music className="w-3.5 h-3.5 text-m3-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs font-semibold text-m3-text truncate">
              {title}
            </p>
            {proposal.artist && (
              <p className="m-0 text-[10.5px] text-m3-secondary truncate">
                {proposal.artist}
              </p>
            )}
          </div>
          {status === "pending" && stats && (
            <span className="font-mono text-[10.5px] font-semibold shrink-0">
              <span className="text-m3-success">+{stats.added}</span>{" "}
              <span className="text-m3-danger">−{stats.removed}</span>
            </span>
          )}
          {status !== "pending" && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium shrink-0 ${statusLine.tone}`}
            >
              <statusLine.icon className="w-3.5 h-3.5" />
              {statusLine.text}
            </span>
          )}
        </div>

        {status === "pending" && (
          <>
            {inEditor ? (
              <p className="m-0 px-3 py-2 text-[11.5px] text-m3-secondary">
                {t("ai.chat.proposals.inEditorNote")}
              </p>
            ) : isLoading || !song ? (
              <p className="m-0 px-3 py-2 text-[11.5px] text-m3-secondary">
                {isLoading
                  ? t("ai.chat.proposals.loadingSong")
                  : t("ai.chat.proposals.songGone")}
              </p>
            ) : (
              <MiniDiff original={song.content} modified={proposal.content} />
            )}

            <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-m3-border/70 bg-m3-sidebar/40">
              {live && !inEditor && song && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] text-m3-secondary hover:text-m3-text px-1.5 py-1 rounded-[var(--radius-sm)] hover:bg-m3-hover"
                  onClick={() => setReview(live)}
                  title={t("ai.chat.proposals.fullReview")}
                >
                  <Maximize2 className="w-3 h-3" />
                  {t("ai.chat.proposals.fullReview")}
                </button>
              )}
              {live && !inEditor && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] text-m3-secondary hover:text-m3-text px-1.5 py-1 rounded-[var(--radius-sm)] hover:bg-m3-hover"
                  onClick={() => openInEditor(live)}
                  title={t("ai.chat.proposals.openEditor")}
                >
                  <ExternalLink className="w-3 h-3" />
                  {t("ai.chat.proposals.openEditor")}
                </button>
              )}
              <span className="flex-1" />
              {live && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<X className="w-3.5 h-3.5" />}
                  disabled={busy}
                  onClick={() => decline(live)}
                >
                  {t("ai.chat.decline")}
                </Button>
              )}
              {live && !inEditor && canUpdate && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Check className="w-3.5 h-3.5" />}
                  disabled={busy || !song}
                  onClick={() => void accept()}
                >
                  {t("ai.chat.accept")}
                </Button>
              )}
            </div>
          </>
        )}

        {review && (
          <AiProposalReview proposal={review} onClose={() => setReview(null)} />
        )}
      </div>
    );
  });
