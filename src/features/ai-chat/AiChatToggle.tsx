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
  // Work in progress and the reaction that follows (done / oops) win; then a
  // waiting proposal; then a friendly hover.
  const mood: LogosMood = busy
    ? chat.mood === "idle"
      ? "working"
      : chat.mood
    : chat.mood !== "idle"
      ? chat.mood
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
      className="group relative shrink-0 w-9 h-9 rounded-[var(--radius-md)] inline-flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-m3-card active:scale-95 transition-transform duration-150"
    >
      {/* A head-and-shoulders crop of Logos in a small tile — recognisable at
          toolbar size, where the full bird would be a tiny blob. */}
      <span
        className={`absolute inset-0 overflow-hidden rounded-[inherit] border transition-[background-color,border-color,box-shadow] duration-300 ${
          chat.open
            ? "border-m3-primary/60 bg-m3-primary/15 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-m3-primary)_14%,transparent)]"
            : "border-m3-primary/25 bg-gradient-to-b from-sky-300/25 to-m3-primary/10 group-hover:border-m3-primary/50 group-hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--color-m3-primary)_22%,transparent)]"
        }`}
      >
        <span className="absolute" style={{ left: -9.5, top: -4.5 }}>
          <LogosMascot
            mood={mood}
            size={54}
            flat
            track
            antics="calm"
            label=""
          />
        </span>
      </span>
      {busy && !chat.open ? (
        <span
          className="absolute -inset-0.5 rounded-[inherit] ring-2 ring-m3-primary/40 animate-pulse pointer-events-none"
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
