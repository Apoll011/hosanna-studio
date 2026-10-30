/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React from "react";
import { useAiChatOptional } from "./AiChatProvider";
import { useAiProposals } from "./proposalStore";

/**
 * A four-point sparkle cluster. The two small stars twinkle on their own
 * (faster while Logos is working) and the whole icon tips on hover.
 */
const SparkIcon: React.FC<{ busy: boolean }> = ({ busy }) => {
  const star = "origin-center [transform-box:fill-box]";
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[18px] h-[18px] transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-110"
      fill="currentColor"
      aria-hidden
    >
      <path
        className={`${star} ${busy ? "animate-pulse" : ""}`}
        d="M10.5 3.2c.4-1 1.6-1 2 0l1.5 4.3a5 5 0 0 0 3 3l4.3 1.5c1 .4 1 1.6 0 2l-4.3 1.5a5 5 0 0 0-3 3l-1.5 4.3c-.4 1-1.6 1-2 0l-1.5-4.3a5 5 0 0 0-3-3l-4.3-1.5c-1-.4-1-1.6 0-2l4.3-1.5a5 5 0 0 0 3-3z"
      />
      <path
        className={`${star} transition-transform duration-300 group-hover:scale-125 ${
          busy ? "animate-pulse [animation-delay:250ms]" : ""
        }`}
        d="M19.5 1.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"
        opacity="0.85"
      />
      <path
        className={`${star} transition-transform duration-300 group-hover:scale-125 ${
          busy ? "animate-pulse [animation-delay:500ms]" : ""
        }`}
        d="M4.5 16.5l.75 1.95 1.95.75-1.95.75-.75 1.95-.75-1.95-1.95-.75 1.95-.75z"
        opacity="0.7"
      />
    </svg>
  );
};

/**
 * Address-bar entry point for Logos: a sparkle button that glows while the
 * assistant works and shows how many proposals are waiting for review.
 */
export const AiChatToggle: React.FC = () => {
  const { t, tc } = useI18n();
  const chat = useAiChatOptional();
  const pending = useAiProposals().length;
  if (!chat?.visible) return null;

  const busy = chat.streaming;
  const label = chat.open ? t("ai.chat.close") : t("ai.chat.open");

  return (
    <button
      type="button"
      onClick={chat.toggle}
      title={`${label} (Ctrl+Shift+L)`}
      aria-label={label}
      aria-pressed={chat.open}
      className={`group relative shrink-0 w-9 h-9 rounded-[var(--radius-md)] inline-flex items-center justify-center cursor-pointer border transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-m3-card ${
        chat.open
          ? "text-white border-transparent bg-gradient-to-br from-sky-400 to-m3-primary shadow-[0_2px_10px_color-mix(in_srgb,var(--color-m3-primary)_40%,transparent)]"
          : "text-m3-primary border-m3-primary/25 bg-gradient-to-br from-sky-400/15 to-m3-primary/10 hover:border-m3-primary/50 hover:from-sky-400/25 hover:to-m3-primary/15 hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--color-m3-primary)_22%,transparent)]"
      }`}
    >
      <SparkIcon busy={busy} />
      {busy && !chat.open ? (
        <span
          className="absolute -inset-0.5 rounded-[inherit] ring-2 ring-m3-primary/35 animate-pulse pointer-events-none"
          aria-hidden
        />
      ) : null}

      {pending > 0 ? (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-m3-primary text-white text-[10px] font-bold leading-4 text-center ring-2 ring-m3-card"
          aria-label={tc("ai.chat.proposals.pending", pending)}
        >
          {pending}
        </span>
      ) : null}
    </button>
  );
};
