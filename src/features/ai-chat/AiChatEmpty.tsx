/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuth } from "@/src/contexts/AuthContext";
import { useI18n } from "@/src/lib/i18n";
import React, { useMemo } from "react";
import { LogosMascot } from "./LogosMascot";
import type { LogosMood, QuickChip } from "./types";

type Props = {
  chips: QuickChip[];
  mood: LogosMood;
  disabled?: boolean;
  onPick: (prompt: string) => void;
};

function firstName(name: string | undefined | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Empty conversation: Logos (poke, pet or wake him), greeting and localized
 * suggestions.
 */
export const AiChatEmpty: React.FC<Props> = ({
  chips,
  mood,
  disabled,
  onPick,
}) => {
  const { t } = useI18n();
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const base =
      h < 12
        ? t("ai.chat.greeting.morning")
        : h < 19
          ? t("ai.chat.greeting.afternoon")
          : t("ai.chat.greeting.evening");
    const name = firstName(user?.name);
    return name ? `${base}, ${name}` : base;
  }, [t, user?.name]);

  // Lots of suggestions: shrink the hero and tile them two across so the
  // whole menu fits without a long scroll.
  const dense = chips.length > 4;

  return (
    <div
      className={`min-h-full flex flex-col items-center justify-center px-4 text-center ${
        dense ? "py-4" : "py-6"
      }`}
    >
      <LogosMascot
        track
        interactive
        size={dense ? 150 : 184}
        mood={mood}
        label={t("ai.chat.mascotLabel")}
      />
      <p className="mt-2 mb-0 text-[11px] font-medium uppercase tracking-wider text-m3-primary">
        {greeting}
      </p>
      <h3 className="mt-1 mb-1 text-[17px] font-semibold text-m3-text">
        {t("ai.chat.emptyTitle")}
      </h3>
      <p className="m-0 max-w-[280px] text-[12.5px] leading-relaxed text-m3-secondary">
        {t("ai.chat.emptySubtitle")}
      </p>

      <p
        className={`mb-2 w-full text-left text-[10.5px] font-semibold uppercase tracking-wider text-m3-secondary ${
          dense ? "mt-4" : "mt-5"
        }`}
      >
        {t("ai.chat.suggestions")}
      </p>
      <div className={`w-full grid gap-1.5 ${dense ? "grid-cols-2" : ""}`}>
        {chips.map((chip, i) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(t(chip.promptKey))}
              title={dense ? t(chip.descKey) : undefined}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`logos-msg-in group flex items-center w-full text-left rounded-[var(--radius-lg)] border border-m3-border bg-m3-card hover:border-m3-primary/50 hover:bg-m3-primary/5 disabled:opacity-50 transition-colors ${
                dense ? "gap-2 px-2 py-1.5" : "gap-3 px-3 py-2"
              }`}
            >
              <span
                className={`shrink-0 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center group-hover:bg-m3-primary group-hover:text-white transition-colors ${
                  dense ? "w-7 h-7" : "w-8 h-8"
                }`}
              >
                <Icon className={dense ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-medium text-m3-text ${
                    dense
                      ? "text-[12px] leading-tight line-clamp-2"
                      : "text-[13px] truncate"
                  }`}
                >
                  {t(chip.labelKey)}
                </span>
                {!dense && (
                  <span className="block text-[11.5px] text-m3-secondary truncate">
                    {t(chip.descKey)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
