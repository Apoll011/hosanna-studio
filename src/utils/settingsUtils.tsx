/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TranslationKey } from "@/src/lib/i18n";
import { Crown, Music, Shield, User, UserCheck, Users } from "lucide-react";

type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

export const getRoleLabel = (role: string, t?: TranslateFn) => {
  switch (role?.toLowerCase()) {
    case "owner":
      return t ? t("settings.roles.owner") : "Proprietário";
    case "admin":
      return t ? t("settings.roles.admin") : "Administrador";
    case "teamleader":
    case "team_leader":
    case "leader":
      return t ? t("settings.roles.teamLeader") : "Líder de Equipa";
    case "editor":
      return t ? t("settings.roles.editor") : "Editor";
    case "musician":
      return t ? t("settings.roles.musician") : "Músico";
    case "guest":
      return t ? t("settings.roles.guest") : "Convidado";
    default:
      return role || (t ? t("settings.roles.member") : "Membro");
  }
};

export const getRoleBadge = (role: string, t?: TranslateFn) => {
  switch (role?.toLowerCase()) {
    case "owner":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Crown className="w-3 h-3 text-amber-500" />
          {t ? t("settings.roles.owner") : "Proprietário"}
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          <Shield className="w-3 h-3 text-sky-500" />
          {t ? t("settings.roles.admin") : "Administrador"}
        </span>
      );
    case "teamleader":
    case "team_leader":
    case "leader":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <UserCheck className="w-3 h-3 text-purple-500" />
          {t ? t("settings.roles.teamLeader") : "Líder de Equipa"}
        </span>
      );
    case "editor":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Users className="w-3 h-3 text-emerald-500" />
          {t ? t("settings.roles.editor") : "Editor"}
        </span>
      );
    case "musician":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Music className="w-3 h-3 text-indigo-500" />
          {t ? t("settings.roles.musician") : "Músico"}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <User className="w-3 h-3 text-slate-400" />
          {getRoleLabel(role, t)}
        </span>
      );
  }
};

export const compressImage = (
  file: File,
  maxWidth = 800,
  quality = 0.8,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get 2d context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
