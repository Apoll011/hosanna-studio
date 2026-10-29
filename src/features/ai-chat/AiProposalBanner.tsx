/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Check, Sparkles, X } from "lucide-react";
import React from "react";
import { AiDiffView } from "./AiDiffView";

export type AiProposalBannerProps = {
  title?: string;
  diffPreview?: string;
  onAccept: () => void;
  onDecline: () => void;
};

/** VS Code-style accept/decline bar for staged AI edits in the editor. */
export const AiProposalBanner: React.FC<AiProposalBannerProps> = ({
  title,
  diffPreview,
  onAccept,
  onDecline,
}) => {
  const { t } = useI18n();

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex flex-col pointer-events-none">
      <div className="pointer-events-auto mx-2 mt-2 rounded-[var(--radius-lg)] border border-m3-primary/40 bg-m3-card shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-m3-border">
          <Sparkles className="w-4 h-4 text-m3-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-m3-text truncate">
              {title || t("ai.chat.proposalTitle")}
            </p>
            <p className="text-[10px] text-m3-secondary truncate">
              {t("ai.chat.proposalHint")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<X className="w-3.5 h-3.5" />}
            onClick={onDecline}
          >
            {t("ai.chat.decline")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Check className="w-3.5 h-3.5" />}
            onClick={onAccept}
          >
            {t("ai.chat.accept")}
          </Button>
        </div>
        {diffPreview && (
          <div className="max-h-40 overflow-auto">
            <AiDiffView preview={diffPreview} className="border-0 rounded-none" />
          </div>
        )}
      </div>
    </div>
  );
};
