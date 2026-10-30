/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandAction } from "@/src/command-palette.types";
import { useCommandPalette } from "@/src/contexts/CommandPaletteContext";
import { useI18n } from "@/src/lib/i18n";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAiChatOptional } from "./AiChatProvider";

const GROUP_ID = "ai-palette";

/**
 * Registers Logos AI actions in the command palette when the assistant is available:
 * open / new chat, and “Ask Logos …” that sends the current search query.
 */
export function useAiCommandPaletteActions() {
  const chat = useAiChatOptional();
  const visible = chat?.visible ?? false;
  const open = chat?.open ?? false;
  const send = chat?.send;
  const setOpen = chat?.setOpen;
  const newChat = chat?.newChat;
  const { t } = useI18n();
  const { searchQuery, registerDynamicActions, unregisterDynamicActions } =
    useCommandPalette();

  useEffect(() => {
    if (!visible || !send || !setOpen || !newChat) {
      unregisterDynamicActions(GROUP_ID);
      return;
    }

    const trimmed = searchQuery.trim();
    const actions: CommandAction[] = [];

    if (trimmed.length > 0) {
      const prompt = trimmed;
      actions.push({
        id: "ai-ask",
        name: t("commandPalette.askAi", { query: prompt }),
        subtitle: t("commandPalette.askAiSubtitle"),
        keywords: `${prompt} logos ai chat ask openai assistant prompt pergunta`,
        section: t("commandPalette.sections.ai"),
        icon: <Sparkles className="w-4 h-4 text-sky-500" />,
        perform: () => {
          void send(prompt);
        },
      });
    }

    actions.push(
      {
        id: "ai-open",
        name: open ? t("commandPalette.focusAi") : t("commandPalette.openAi"),
        shortcut: open ? undefined : ["g", "l"],
        keywords: "logos ai chat openai assistant painel panel open abrir",
        section: t("commandPalette.sections.ai"),
        icon: <Sparkles className="w-4 h-4 text-sky-500" />,
        perform: () => setOpen(true),
      },
      {
        id: "ai-new-chat",
        name: t("commandPalette.newAiChat"),
        keywords: "logos ai chat nova conversa new conversation clear",
        section: t("commandPalette.sections.ai"),
        icon: <MessageSquarePlus className="w-4 h-4 text-sky-500" />,
        perform: () => {
          newChat();
          setOpen(true);
        },
      },
    );

    if (open) {
      actions.push({
        id: "ai-close",
        name: t("commandPalette.closeAi"),
        keywords: "logos ai chat fechar close hide",
        section: t("commandPalette.sections.ai"),
        icon: <Sparkles className="w-4 h-4 text-slate-500" />,
        perform: () => setOpen(false),
      });
    }

    registerDynamicActions(GROUP_ID, actions);
    return () => unregisterDynamicActions(GROUP_ID);
  }, [
    visible,
    open,
    send,
    setOpen,
    newChat,
    searchQuery,
    registerDynamicActions,
    unregisterDynamicActions,
    t,
  ]);
}
