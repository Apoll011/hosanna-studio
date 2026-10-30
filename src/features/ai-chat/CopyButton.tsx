/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Check, Copy } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  /** Text, or a lazy getter evaluated at click time. */
  text: string | (() => string);
  className?: string;
  iconClassName?: string;
  label?: string;
};

/** Copy-to-clipboard icon button with a brief "copied" confirmation. */
export const CopyButton: React.FC<Props> = ({
  text,
  className = "",
  iconClassName = "w-3.5 h-3.5",
  label,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const value = typeof text === "function" ? text() : text;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const title = copied ? t("ai.chat.copied") : (label ?? t("ai.chat.copy"));
  return (
    <button
      type="button"
      onClick={onCopy}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] text-m3-secondary hover:text-m3-text hover:bg-m3-hover transition-colors ${className}`}
    >
      {copied ? (
        <Check className={`${iconClassName} text-emerald-500`} />
      ) : (
        <Copy className={iconClassName} />
      )}
    </button>
  );
};
