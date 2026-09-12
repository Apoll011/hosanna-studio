/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Collection } from "@/src/types";
import { compressImage } from "@/src/utils/settingsUtils";
import {
  Check,
  ImageIcon,
  Loader2,
  Palette,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setName(collection.name || "");
        setDescription(collection.description || "");
        setSelectedColor(collection.color || "default");
        setSelectedIcon(collection.icon || "music");
        setImageBase64(collection.image || null);
      } else {
        setName("");
        setDescription("");
        setSelectedColor("default");
        setSelectedIcon("music");
        setImageBase64(null);
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

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file, 800, 0.8);
      setImageBase64(compressed);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleImageInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) await handleImageFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleImageFile(file);
  };

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
        image: imageBase64 || null,
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
      <form onSubmit={handleSave} className="flex flex-col gap-5 pr-0.5">
        {/* Live Preview Card */}
        <div className="relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/70 dark:to-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
          {imageBase64 ? (
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
              <img
                src={imageBase64}
                alt="cover"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm shrink-0 ${previewColorStyle.bgClass} ${previewColorStyle.borderClass} ${previewColorStyle.textClass}`}
            >
              <PreviewIcon className="w-7 h-7" />
            </div>
          )}
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
          <div className="px-3.5 py-2.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl">
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

        {/* Description */}
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
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none"
          />
        </div>

        {/* Cover Image Upload */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
            <span>
              {locale === "pt"
                ? "Imagem de Capa (opcional)"
                : "Cover Image (optional)"}
            </span>
          </label>

          {imageBase64 ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group h-28">
              <img
                src={imageBase64}
                alt="cover preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold bg-white/90 text-slate-800 rounded-lg hover:bg-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {locale === "pt" ? "Trocar" : "Change"}
                </button>
                <button
                  type="button"
                  onClick={() => setImageBase64(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-rose-500/90 text-white rounded-lg hover:bg-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {locale === "pt" ? "Remover" : "Remove"}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => imageInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-sky-400 hover:bg-sky-50/60 dark:hover:bg-sky-950/20"
              }`}
            >
              {isCompressing ? (
                <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
              ) : (
                <>
                  <UploadCloud
                    className={`w-5 h-5 ${isDragging ? "text-sky-500" : "text-slate-400"}`}
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                    {locale === "pt"
                      ? "Clique ou arraste uma imagem"
                      : "Click or drag an image here"}
                  </span>
                </>
              )}
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageInputChange}
            className="hidden"
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
        {/* Icon Selection with Search Header */}
        <div className="flex flex-col gap-2 min-h-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>
                {t("modals.iconCount", { count: filteredIcons.length })}
              </span>
            </label>

            {/* Quick Search */}
            <div className="relative w-36 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t("modals.searchIcons")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Icons Grid with dedicated scroll containment */}
          <div className="relative flex-1 min-h-35 max-h-55 sm:max-h-60 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {filteredIcons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center text-slate-400">
                <Search className="w-6 h-6 mb-1 opacity-50" />
                <p className="text-xs">
                  {t("modals.noIconFound", { query: searchQuery })}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
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
                      className={`group relative flex flex-col items-center justify-center aspect-square p-2 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 font-semibold shadow-2xs"
                          : "bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105"
                      }`}
                    >
                      <IconComp className="w-5 h-5 transition-transform group-hover:scale-110" />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full text-center mt-1 leading-none opacity-80 group-hover:opacity-100">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
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
