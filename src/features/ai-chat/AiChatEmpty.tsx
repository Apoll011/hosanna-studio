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

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-6 text-center">
      <LogosMascot
        track
        interactive
        size={132}
        mood={mood}
        label={t("ai.chat.mascotLabel")}
      />
      <p className="mt-3 mb-0 text-[11px] font-medium uppercase tracking-wider text-m3-primary">
        {greeting}
      </p>
      <h3 className="mt-1 mb-1 text-[17px] font-semibold text-m3-text">
        {t("ai.chat.emptyTitle")}
      </h3>
      <p className="m-0 max-w-[280px] text-[12.5px] leading-relaxed text-m3-secondary">
        {t("ai.chat.emptySubtitle")}
      </p>

      <p className="mt-5 mb-2 w-full text-left text-[10.5px] font-semibold uppercase tracking-wider text-m3-secondary">
        {t("ai.chat.suggestions")}
      </p>
      <div className="w-full grid gap-1.5">
        {chips.map((chip, i) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(t(chip.promptKey))}
              style={{ animationDelay: `${i * 45}ms` }}
              className="logos-msg-in group flex items-center gap-3 w-full text-left rounded-[var(--radius-lg)] border border-m3-border bg-m3-card px-3 py-2 hover:border-m3-primary/50 hover:bg-m3-primary/5 disabled:opacity-50 transition-colors"
            >
              <span className="shrink-0 w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center group-hover:bg-m3-primary group-hover:text-white transition-colors">
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-m3-text truncate">
                  {t(chip.labelKey)}
                </span>
                <span className="block text-[11.5px] text-m3-secondary truncate">
                  {t(chip.descKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
