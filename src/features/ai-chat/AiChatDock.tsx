/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AiChatPanel } from "./AiChatPanel";
import { useAiChat } from "./AiChatProvider";

/** Width-animating dock column for MainLayout (must sit under AiChatProvider). */
export const AiChatDock: React.FC = () => {
  const { open, visible } = useAiChat();
  if (!visible) return null;

  return (
    <div
      className={`h-full shrink-0 overflow-hidden border-l border-m3-border transition-[width] duration-200 ease-out ${
        open ? "w-full max-w-[400px] sm:w-[400px]" : "w-0 border-l-0"
      }`}
    >
      <div className="h-full w-full sm:w-[400px]">
        <AiChatPanel />
      </div>
    </div>
  );
};
