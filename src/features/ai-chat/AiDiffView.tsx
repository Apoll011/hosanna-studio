/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";

export interface AiDiffViewProps {
  preview: string;
  className?: string;
}

export const AiDiffView: React.FC<AiDiffViewProps> = ({
  preview,
  className = "",
}) => {
  const lines = useMemo(() => preview.split("\n"), [preview]);

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-m3-border overflow-hidden bg-m3-sidebar/60 ${className}`}
    >
      <pre className="text-[11px] leading-relaxed font-mono overflow-x-auto p-2.5 max-h-64 overflow-y-auto m-0">
        {lines.map((line, i) => {
          const isAdd = line.startsWith("+");
          const isDel = line.startsWith("-") && !line.startsWith("---");
          const isMeta = line.startsWith("…") || line.startsWith("(");
          let color = "text-m3-text/80";
          let bg = "";
          if (isAdd) {
            color = "text-emerald-700 dark:text-emerald-300";
            bg = "bg-emerald-500/10";
          } else if (isDel) {
            color = "text-red-700 dark:text-red-300";
            bg = "bg-red-500/10";
          } else if (isMeta) {
            color = "text-m3-secondary";
          }
          return (
            <div key={i} className={`${bg} ${color} px-1 whitespace-pre-wrap`}>
              {line || " "}
            </div>
          );
        })}
      </pre>
    </div>
  );
};
