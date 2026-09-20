/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrintModal } from "@/src/components/print/PrintModal";
import {
  PrintItem,
  PrintOptions,
  PrintPayload,
} from "@/src/components/print/types";
import {
  AgendaEvent,
  Collection,
  Folder,
  ResponsibilityCategory,
  Service,
  Song,
} from "@/src/types";
import React, { createContext, useCallback, useContext, useState } from "react";

export interface PrintContextValue {
  isPrintModalOpen: boolean;
  openPrintModal: (payload: PrintPayload) => void;
  closePrintModal: () => void;
  printSong: (song: Song, options?: Partial<PrintOptions>) => void;
  printSongs: (
    songs: Song[],
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
  printFolder: (
    folder: Folder,
    songs?: Song[],
    options?: Partial<PrintOptions>,
  ) => void;
  printFolders: (
    foldersWithSongs: Array<{ folder: Folder; songs?: Song[] }>,
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
  printCollection: (
    collection: Collection,
    songs?: Song[],
    options?: Partial<PrintOptions>,
  ) => void;
  printCollections: (
    collectionsWithSongs: Array<{ collection: Collection; songs?: Song[] }>,
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
  printService: (
    service: Service,
    songs?: Song[],
    options?: Partial<PrintOptions>,
  ) => void;
  printServices: (
    servicesWithSongs: Array<{ service: Service; songs?: Song[] }>,
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
  printEvent: (
    event: AgendaEvent,
    categories?: ResponsibilityCategory[],
    options?: Partial<PrintOptions>,
  ) => void;
  printEvents: (
    events: AgendaEvent[],
    categories?: ResponsibilityCategory[],
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
  printBatch: (
    items: PrintItem[],
    title?: string,
    options?: Partial<PrintOptions>,
  ) => void;
}

const PrintContext = createContext<PrintContextValue | null>(null);

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<PrintPayload | null>(null);

  const openPrintModal = useCallback((newPayload: PrintPayload) => {
    setPayload(newPayload);
    setIsOpen(true);
  }, []);

  const closePrintModal = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  const printSong = useCallback(
    (song: Song, options?: Partial<PrintOptions>) => {
      openPrintModal({
        title: song.title,
        items: [{ type: "song", data: song }],
        options,
      });
    },
    [openPrintModal],
  );

  const printSongs = useCallback(
    (songs: Song[], title?: string, options?: Partial<PrintOptions>) => {
      openPrintModal({
        title: title || `Coletânea (${songs.length} cânticos)`,
        items: songs.map((s) => ({ type: "song", data: s })),
        options,
      });
    },
    [openPrintModal],
  );

  const printFolder = useCallback(
    (folder: Folder, songs?: Song[], options?: Partial<PrintOptions>) => {
      openPrintModal({
        title: `Pasta: ${folder.name}`,
        items: [{ type: "folder", data: folder, songs }],
        options,
      });
    },
    [openPrintModal],
  );

  const printFolders = useCallback(
    (
      foldersWithSongs: Array<{ folder: Folder; songs?: Song[] }>,
      title?: string,
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: title || `Pastas (${foldersWithSongs.length})`,
        items: foldersWithSongs.map((f) => ({
          type: "folder",
          data: f.folder,
          songs: f.songs,
        })),
        options,
      });
    },
    [openPrintModal],
  );

  const printCollection = useCallback(
    (
      collection: Collection,
      songs?: Song[],
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: `Coleção: ${collection.name}`,
        items: [{ type: "collection", data: collection, songs }],
        options,
      });
    },
    [openPrintModal],
  );

  const printCollections = useCallback(
    (
      collectionsWithSongs: Array<{ collection: Collection; songs?: Song[] }>,
      title?: string,
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: title || `Coleções (${collectionsWithSongs.length})`,
        items: collectionsWithSongs.map((c) => ({
          type: "collection",
          data: c.collection,
          songs: c.songs,
        })),
        options,
      });
    },
    [openPrintModal],
  );

  const printService = useCallback(
    (service: Service, songs?: Song[], options?: Partial<PrintOptions>) => {
      openPrintModal({
        title: `Plano de Culto: ${service.name}`,
        items: [{ type: "service", data: service, songs }],
        options,
      });
    },
    [openPrintModal],
  );

  const printServices = useCallback(
    (
      servicesWithSongs: Array<{ service: Service; songs?: Song[] }>,
      title?: string,
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: title || `Cultos (${servicesWithSongs.length})`,
        items: servicesWithSongs.map((s) => ({
          type: "service",
          data: s.service,
          songs: s.songs,
        })),
        options,
      });
    },
    [openPrintModal],
  );

  const printEvent = useCallback(
    (
      event: AgendaEvent,
      categories?: ResponsibilityCategory[],
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: `Evento: ${event.title}`,
        items: [{ type: "event", data: event, categories }],
        options,
      });
    },
    [openPrintModal],
  );

  const printEvents = useCallback(
    (
      events: AgendaEvent[],
      categories?: ResponsibilityCategory[],
      title?: string,
      options?: Partial<PrintOptions>,
    ) => {
      openPrintModal({
        title: title || `Agenda (${events.length} eventos)`,
        items: events.map((e) => ({
          type: "event",
          data: e,
          categories,
        })),
        options,
      });
    },
    [openPrintModal],
  );

  const printBatch = useCallback(
    (items: PrintItem[], title?: string, options?: Partial<PrintOptions>) => {
      openPrintModal({
        title: title || `Lote de Impressão (${items.length} itens)`,
        items,
        options,
      });
    },
    [openPrintModal],
  );

  return (
    <PrintContext.Provider
      value={{
        isPrintModalOpen: isOpen,
        openPrintModal,
        closePrintModal,
        printSong,
        printSongs,
        printFolder,
        printFolders,
        printCollection,
        printCollections,
        printService,
        printServices,
        printEvent,
        printEvents,
        printBatch,
      }}
    >
      {children}
      <PrintModal isOpen={isOpen} onClose={closePrintModal} payload={payload} />
    </PrintContext.Provider>
  );
};

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) {
    throw new Error("usePrint must be used within a PrintProvider");
  }
  return ctx;
}
