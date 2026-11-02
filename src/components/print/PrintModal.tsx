/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from "@/src/components/common";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSync } from "@/src/contexts/SyncContext";
import { useI18n } from "@/src/lib/i18n";
import {
  Maximize2,
  Printer,
  RotateCcw,
  Save,
  SeparatorHorizontal,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mmToPx,
  PAGE_MARGINS_MM,
  PAPER_SIZES,
  resolvePrintOptions,
} from "./options";
import { PrintOptionsPanel } from "./PrintOptionsPanel";
import { triggerPrint } from "./printEngine";
import { ensurePrintStyles } from "./printStyles";
import { PrintDocument } from "./templates/PrintDocument";
import { PrintBrand, PrintOptions, PrintPayload } from "./types";
import { usePrintDefaults } from "./usePrintDefaults";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: PrintPayload | null;
  defaultOptions?: Partial<PrintOptions>;
}

interface PageGuide {
  top: number;
  left: number;
  width: number;
  page: number;
}

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5];
const CANVAS_PADDING_PX = 48;

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  payload,
  defaultOptions,
}) => {
  if (!isOpen || !payload || payload.items.length === 0) return null;
  return (
    <PrintModalContent
      payload={payload}
      onClose={onClose}
      defaultOptions={defaultOptions}
    />
  );
};

const PrintModalContent: React.FC<{
  payload: PrintPayload;
  onClose: () => void;
  defaultOptions?: Partial<PrintOptions>;
}> = ({ payload, onClose, defaultOptions }) => {
  const { organization } = useAuth();
  const { t, tc, locale } = useI18n();
  const { showToast } = useSync();
  const { defaults, canSave, save } = usePrintDefaults();
  const titleId = useId();
  useLayoutEffect(ensurePrintStyles, []);

  const [initialOptions] = useState(() =>
    resolvePrintOptions(defaultOptions, defaults, payload.options),
  );
  const [options, setOptions] = useState<PrintOptions>(initialOptions);
  const updateOptions = useCallback(
    (patch: Partial<PrintOptions>) =>
      setOptions((prev) => ({ ...prev, ...patch })),
    [],
  );
  const isDirty = JSON.stringify(options) !== JSON.stringify(initialOptions);

  const [mobileView, setMobileView] = useState<"preview" | "options">(
    "preview",
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuides, setShowGuides] = useState(true);

  const brand = useMemo<PrintBrand>(() => {
    const meta = (organization?.metadata as Record<string, unknown>) || {};
    const settings = (meta.settings as Record<string, unknown>) || {};
    const appearance = (settings.appearance as Record<string, unknown>) || {};
    return {
      churchName: organization?.name || "",
      churchShortName:
        (meta.shortName as string) || organization?.slug || undefined,
      churchLogo: organization?.logo || null,
      accentColor: (appearance.accentColor as string) || "#0284c7",
      locale,
    };
  }, [organization, locale]);

  const title = payload.title || t("print.documentDefaultTitle");
  const context = useMemo(() => {
    const items = payload.items;
    const hasSongContainers = items.some(
      (i) =>
        i.type === "folder" || i.type === "collection" || i.type === "service",
    );
    const hasSongs = items.some(
      (i) =>
        i.type === "song" ||
        ((i.type === "folder" ||
          i.type === "collection" ||
          i.type === "service") &&
          (i.songs?.length ?? 0) > 0),
    );
    return { hasSongs, hasSongContainers: hasSongContainers && hasSongs };
  }, [payload.items]);

  /* ── Zoom ── */
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const paper = PAPER_SIZES[options.paperSize];
  const paperWidthPx = mmToPx(paper.w);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const available = canvas.clientWidth - CANVAS_PADDING_PX;
      if (available > 0) {
        setFitZoom(Math.min(1.25, Math.max(0.35, available / paperWidthPx)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paperWidthPx, mobileView]);

  const effectiveZoom = zoom === "fit" ? fitZoom : zoom;
  const stepZoom = (direction: 1 | -1) => {
    const current = effectiveZoom;
    const next =
      direction > 0
        ? ZOOM_STEPS.find((z) => z > current + 0.001)
        : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
    if (next) setZoom(next);
  };

  /* ── Page guides & page estimate ── */
  const [guides, setGuides] = useState<PageGuide[]>([]);
  const [pageCount, setPageCount] = useState(1);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    const doc = previewRef.current?.firstElementChild as HTMLElement | null;
    if (!stack || !doc) return;
    const margin = mmToPx(PAGE_MARGINS_MM[options.margins]);
    const contentHeight = mmToPx(paper.h) - margin * 2;

    // Rects are in zoomed screen pixels; guides live inside the zoomed stack.
    const measure = () => {
      const origin = stack.getBoundingClientRect();
      const papers = doc.classList.contains("hp-breaks")
        ? (Array.from(doc.children) as HTMLElement[])
        : [doc];
      const next: PageGuide[] = [];
      let total = 0;
      for (const sheet of papers) {
        const rect = sheet.getBoundingClientRect();
        const top = (rect.top - origin.top) / effectiveZoom;
        const inner = rect.height / effectiveZoom - margin * 2;
        const pages = Math.max(1, Math.ceil((inner - 1) / contentHeight));
        for (let k = 1; k < pages; k++) {
          next.push({
            top: top + margin + k * contentHeight,
            left: (rect.left - origin.left) / effectiveZoom,
            width: rect.width / effectiveZoom,
            page: total + k + 1,
          });
        }
        total += pages;
      }
      setGuides(next);
      setPageCount(total);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(doc);
    return () => observer.disconnect();
  }, [options, paper.h, payload.items, effectiveZoom]);

  /* ── Actions ── */
  const handlePrint = useCallback(async () => {
    if (!previewRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await triggerPrint(previewRef.current, title, options);
    } finally {
      setIsPrinting(false);
    }
  }, [isPrinting, options, title]);

  const handleSaveDefault = async () => {
    setIsSaving(true);
    try {
      await save(options);
      showToast(t("print.modal.savedDefault"), "success");
    } catch {
      showToast(t("print.modal.saveDefaultError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void handlePrint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrint, onClose]);

  const iconButton =
    "inline-flex items-center justify-center min-h-9 min-w-9 rounded-[var(--radius-md)] text-m3-secondary hover:text-m3-text hover:bg-m3-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const pillButton =
    "inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-full text-m3-secondary hover:text-m3-text hover:bg-m3-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-m3-card sm:border border-m3-border sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] flex flex-col w-full max-w-[1440px] h-full sm:h-[94vh] overflow-hidden"
      >
        {/* ── Top bar ── */}
        <div className="px-3 sm:px-5 py-2.5 border-b border-m3-border flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex p-2 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[15px] font-semibold text-m3-text truncate"
            >
              {title}
            </h2>
            <p className="text-xs text-m3-secondary truncate">
              {[
                tc("print.modal.itemCount", payload.items.length),
                tc("print.modal.pageEstimate", pageCount),
                t(`print.templates.${options.templateFamily}.name`),
              ].join(" · ")}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileView((v) => (v === "preview" ? "options" : "preview"))
            }
            className={`lg:hidden ${iconButton} ${mobileView === "options" ? "bg-m3-primary/10 text-m3-primary" : ""}`}
            aria-pressed={mobileView === "options"}
            aria-label={t("print.modal.options")}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hidden sm:inline-flex"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => void handlePrint()}
            isLoading={isPrinting}
            title={t("print.modal.printShortcut")}
          >
            {t("print.modal.print")}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className={iconButton}
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* ── Preview ── */}
          <div
            className={`${mobileView === "preview" ? "flex" : "hidden"} lg:flex flex-1 min-w-0 flex-col relative bg-slate-200/70 dark:bg-slate-950`}
          >
            <div
              ref={canvasRef}
              className="flex-1 overflow-auto px-6 pt-6 pb-20"
            >
              <div
                ref={stackRef}
                className="relative mx-auto w-fit"
                style={{ zoom: String(effectiveZoom) } as React.CSSProperties}
              >
                <div ref={previewRef} className="hp-screen">
                  <PrintDocument
                    items={payload.items}
                    title={payload.title}
                    options={options}
                    brand={brand}
                  />
                </div>
                {showGuides &&
                  guides.map((g) => (
                    <div
                      key={g.page}
                      className="absolute pointer-events-none"
                      style={{ top: g.top, left: g.left, width: g.width }}
                      aria-hidden="true"
                    >
                      <div className="border-t border-dashed border-sky-500/70" />
                      <span className="absolute right-2 -top-2.5 px-1.5 rounded bg-sky-500 text-white text-[10px] font-semibold leading-5">
                        {t("print.modal.pageN", { page: g.page })}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-m3-card/95 border border-m3-border shadow-[var(--shadow-md)] backdrop-blur">
              <button
                type="button"
                className={pillButton}
                onClick={() => stepZoom(-1)}
                disabled={effectiveZoom <= ZOOM_STEPS[0]}
                aria-label={t("print.modal.zoomOut")}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`${pillButton} w-14 text-xs font-semibold tabular-nums text-m3-text`}
                onClick={() => setZoom(1)}
                title={t("print.modal.actualSize")}
              >
                {Math.round(effectiveZoom * 100)}%
              </button>
              <button
                type="button"
                className={pillButton}
                onClick={() => stepZoom(1)}
                disabled={effectiveZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                aria-label={t("print.modal.zoomIn")}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="w-px h-5 bg-m3-border mx-1" />
              <button
                type="button"
                className={`${pillButton} ${zoom === "fit" ? "text-m3-primary" : ""}`}
                onClick={() => setZoom("fit")}
                aria-pressed={zoom === "fit"}
                title={t("print.modal.fitWidth")}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`${pillButton} ${showGuides ? "text-m3-primary" : ""}`}
                onClick={() => setShowGuides((v) => !v)}
                aria-pressed={showGuides}
                title={t("print.modal.pageGuides")}
              >
                <SeparatorHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Options sidebar ── */}
          <div
            className={`${mobileView === "options" ? "flex" : "hidden"} lg:flex w-full lg:w-[360px] shrink-0 flex-col border-l border-m3-border bg-m3-card min-h-0`}
          >
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <PrintOptionsPanel
                options={options}
                onChange={updateOptions}
                brand={brand}
                context={context}
              />
            </div>
            <div className="shrink-0 border-t border-m3-border px-4 py-3 space-y-2 bg-m3-sidebar/40">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => setOptions(initialOptions)}
                  disabled={!isDirty}
                >
                  {t("print.modal.reset")}
                </Button>
                {canSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={() => void handleSaveDefault()}
                    isLoading={isSaving}
                    className="ml-auto"
                  >
                    {t("print.modal.saveDefault")}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-m3-secondary leading-snug">
                {t("print.modal.pdfHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
