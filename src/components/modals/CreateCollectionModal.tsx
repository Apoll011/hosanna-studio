/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Collection } from "@/src/types";
import {
  Check,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  FOLDER_COLORS,
  FOLDER_ICONS,
  getFolderColorStyle,
  getFolderIconComponent,
} from "../../utils/folderCustomization";

export interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection?: Collection | null;
  onSave: (data: {
    name: string;
    description?: string | null;
    color?: string;
    icon?: string;
    image?: string | null;
  }) => Promise<void>;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
  onSave,
}) => {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("default");
  const [selectedIcon, setSelectedIcon] = useState("music");
  const [imageUrl, setImageUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setName(collection.name || "");
        setDescription(collection.description || "");
        setSelectedColor(collection.color || "default");
        setSelectedIcon(collection.icon || "music");
        setImageUrl(collection.image || "");
      } else {
        setName("");
        setDescription("");
        setSelectedColor("default");
        setSelectedIcon("music");
        setImageUrl("");
      }
      setSearchQuery("");
      setError("");
    }
  }, [isOpen, collection]);

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return FOLDER_ICONS;

    const normalizedQuery = searchQuery
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return FOLDER_ICONS.filter((item) => {
      const normalizedName = item.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedQuery);
    });
  }, [searchQuery]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(
        locale === "pt"
          ? "O nome da coleção é obrigatório."
          : "Collection name is required.",
      );
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        color: selectedColor,
        icon: selectedIcon,
        image: imageUrl.trim() ? imageUrl.trim() : null,
      });
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as Error).message);
      } else {
        setError(
          locale === "pt"
            ? "Ocorreu um erro ao salvar a coleção."
            : "An error occurred while saving the collection.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const PreviewIcon = getFolderIconComponent(selectedIcon);
  const previewColorStyle = getFolderColorStyle(selectedColor);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        collection
          ? locale === "pt"
            ? "Editar Coleção"
            : "Edit Collection"
          : locale === "pt"
            ? "Nova Coleção"
            : "New Collection"
      }
    >
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1"
      >
        {/* Live Preview Card */}
        <div className="relative overflow-hidden flex items-center gap-4 p-3.5 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/70 dark:to-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm shrink-0 ${previewColorStyle.bgClass} ${previewColorStyle.borderClass} ${previewColorStyle.textClass}`}
          >
            <PreviewIcon className="w-7 h-7" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {name ||
                (locale === "pt" ? "Título da Coleção" : "Collection Title")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {description ||
                (locale === "pt"
                  ? "Descrição da coleção..."
                  : "Collection description...")}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl">
            {error}
          </div>
        )}

        {/* Collection Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            {locale === "pt" ? "Nome da Coleção *" : "Collection Name *"}
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder={
              locale === "pt"
                ? "Ex: Louvor e Adoração, Jovens, Culto de Domingo..."
                : "e.g. Praise & Worship, Youth, Sunday Service..."
            }
            autoFocus
            required
          />
        </div>

        {/* Collection Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            {locale === "pt"
              ? "Descrição (opcional)"
              : "Description (optional)"}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={
              locale === "pt"
                ? "Músicas para momentos de louvor e adoração a Deus..."
                : "Songs for praise and worship moments..."
            }
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none"
          />
        </div>

        {/* Banner Image URL (optional) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
            <span>
              {locale === "pt"
                ? "Imagem de Capa / URL (opcional)"
                : "Cover Image URL (optional)"}
            </span>
          </label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/..."
          />
        </div>

        {/* Color Swatches */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-sky-500" />
              <span>{locale === "pt" ? "Cor" : "Color"}</span>
            </label>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {previewColorStyle.name}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-1">
            {FOLDER_COLORS.map((c) => {
              const isSelected = selectedColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  title={c.name}
                  aria-label={`Cor ${c.name}`}
                  className={`group relative w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-sky-500 dark:ring-offset-slate-900 scale-110 shadow-sm"
                      : "hover:scale-110 opacity-90 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.colorHex }}
                >
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 ${
                        c.id === "yellow" || c.id === "white" || c.id === "lime"
                          ? "text-slate-900"
                          : "text-white"
                      } drop-shadow`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Selection */}
        <div className="flex flex-col gap-2 min-h-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>{locale === "pt" ? "Ícone" : "Icon"}</span>
            </label>

            <div className="relative w-36 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  locale === "pt" ? "Buscar ícone..." : "Search icon..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="relative max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {filteredIcons.map((item) => {
                const IconComp = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    title={item.name}
                    aria-label={item.name}
                    className={`group relative flex items-center justify-center aspect-square p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 font-semibold shadow-2xs"
                        : "bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105"
                    }`}
                  >
                    <IconComp className="w-5 h-5 transition-transform group-hover:scale-110" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving}
            className="min-w-28"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("modals.saving")}
              </span>
            ) : collection ? (
              t("common.save")
            ) : locale === "pt" ? (
              "Criar Coleção"
            ) : (
              "Create Collection"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
