/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Collection } from "@/src/types";
import {
  getFolderColorStyle,
  getFolderIconComponent,
} from "@/src/utils/folderCustomization";
import { Check, FolderPlus, LibraryBig, Search } from "lucide-react";
import React, { useMemo, useState } from "react";

export interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  songTitle?: string;
  songCount?: number;
  onConfirm: (collectionId: string) => Promise<void>;
  onCreateNewCollection?: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  isOpen,
  onClose,
  collections,
  songTitle,
  songCount = 1,
  onConfirm,
  onCreateNewCollection,
}) => {
  const { t } = useI18n();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedCollectionId(null);
      setSearchQuery("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase().trim();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)),
    );
  }, [collections, searchQuery]);

  const handleConfirm = async () => {
    if (!selectedCollectionId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedCollectionId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("collectionsPage.addToCollection")}
    >
      <div className="flex flex-col gap-4 max-h-[75vh]">
        {songTitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("collectionsPage.selectCollectionPrompt")}{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {songTitle}
            </strong>
          </p>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("collectionsPage.selectCollectionPrompt")} ({songCount}{" "}
            {t("common.songs").toLowerCase()})
          </p>
        )}

        {collections.length > 5 && (
          <Input
            placeholder={t("addressBar.searchCollections")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
        )}

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {filteredCollections.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-center text-amber-500">
                <LibraryBig className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {collections.length === 0
                  ? t("collectionsPage.createCollectionFirst")
                  : t("collectionsPage.noCollectionsAvailable")}
              </p>
              {onCreateNewCollection && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<FolderPlus className="w-4 h-4" />}
                  onClick={() => {
                    onClose();
                    onCreateNewCollection();
                  }}
                >
                  {t("collectionsPage.newCollection")}
                </Button>
              )}
            </div>
          ) : (
            filteredCollections.map((col) => {
              const IconComp = getFolderIconComponent(col.icon);
              const colorStyle = getFolderColorStyle(col.color);
              const count = col.songCount ?? col.songIds?.length ?? 0;
              const isSelected = selectedCollectionId === col.id;

              return (
                <label
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`flex items-center justify-between p-3 border rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-sky-50/80 dark:bg-sky-950/40 border-sky-500 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs`}
                      style={{ backgroundColor: colorStyle.colorHex }}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {col.name}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {t("collectionsPage.songCount", { count })}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-sky-600 border-sky-600 text-white"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!selectedCollectionId || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? t("common.loading") : t("common.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
