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
      className={`group relative shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary/40 active:scale-95 ${
        chat.open
          ? "bg-m3-primary/12 ring-1 ring-m3-primary/30"
          : "hover:bg-m3-hover"
      }`}
    >
      <LogosMascot mood={mood} size={28} flat antics="calm" label="" />
      {busy && !chat.open ? (
        <span
          className="absolute inset-0.5 rounded-[10px] ring-2 ring-m3-primary/40 animate-pulse"
          aria-hidden
        />
      ) : null}

      {pending > 0 ? (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-m3-primary text-white text-[10px] font-bold leading-4 text-center ring-2 ring-m3-card"
          aria-label={tc("ai.chat.proposals.pending", pending)}
        >
          {pending}
        </span>
      ) : busy && !chat.open ? (
        <span
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-m3-primary animate-ping"
          aria-hidden
        />
      ) : null}
    </button>
  );
};
