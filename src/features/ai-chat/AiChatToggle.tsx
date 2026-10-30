/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React, { useState } from "react";
import { useAiChatOptional } from "./AiChatProvider";
import { LogosMascot } from "./LogosMascot";
import { useAiProposals } from "./proposalStore";
import type { LogosMood } from "./types";

/**
 * Address-bar entry point for Logos: the mascot reacts to what the assistant
 * is doing (working / waiting for review) and wakes up on hover.
 */
export const AiChatToggle: React.FC = () => {
  const { t, tc } = useI18n();
  const chat = useAiChatOptional();
  const pending = useAiProposals().length;
  const [hover, setHover] = useState(false);
  if (!chat?.visible) return null;

  const busy = chat.streaming;
  const mood: LogosMood = busy
    ? chat.mood === "idle"
      ? "working"
      : chat.mood
    : pending > 0
      ? "helping"
      : hover
        ? "happy"
        : "idle";

  const label = chat.open ? t("ai.chat.close") : t("ai.chat.open");

  return (
    <button
      type="button"
      onClick={chat.toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      title={`${label} (Ctrl+Shift+L)`}
      aria-label={label}
      aria-pressed={chat.open}
      className={`group relative shrink-0 h-9 pl-1 pr-1.5 xl:pr-3 rounded-[var(--radius-md)] inline-flex items-center gap-1.5 border text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary/40 active:scale-[0.97] ${
        chat.open
          ? "bg-m3-primary/10 border-m3-primary/50 text-m3-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-m3-primary)_20%,transparent)]"
          : "bg-m3-card border-m3-border text-m3-text hover:border-m3-primary/40 hover:bg-m3-primary/5 hover:shadow-sm"
      }`}
    >
      <span
        className={`relative flex items-center justify-center w-7 h-7 rounded-[calc(var(--radius-md)-3px)] transition-colors ${
          chat.open
            ? "bg-m3-primary/15"
            : "bg-gradient-to-br from-sky-400/15 to-m3-primary/10 group-hover:from-sky-400/25"
        }`}
      >
        <LogosMascot mood={mood} size={26} flat label="" />
        {busy && !chat.open ? (
          <span
            className="absolute inset-0 rounded-[inherit] ring-2 ring-m3-primary/50 animate-pulse"
            aria-hidden
          />
        ) : null}
      </span>
      <span className="hidden xl:inline leading-none">Logos</span>

      {pending > 0 ? (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-m3-primary text-white text-[10px] font-bold leading-4 text-center ring-2 ring-m3-card"
          aria-label={tc("ai.chat.proposals.pending", pending)}
        >
          {pending}
        </span>
      ) : busy && !chat.open ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-m3-primary animate-ping"
          aria-hidden
        />
      ) : null}
    </button>
  );
};
