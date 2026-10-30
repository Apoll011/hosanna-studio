/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAiChat } from "./AiChatProvider";

// Heavy chat UI (markdown, mascot, history) loads only when first opened.
const AiChatPanel = lazy(() =>
  import("./AiChatPanel").then((m) => ({ default: m.AiChatPanel })),
);

const WIDTH_KEY = "hosanna:ai-chat-width";
const MIN_W = 340;
const MAX_W = 760;
const DEFAULT_W = 400;
const WIDE_W = 640;

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(v) && v >= MIN_W && v <= MAX_W) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_W;
}

/**
 * Resizable dock column for MainLayout (must sit under AiChatProvider).
 * On small screens it becomes a full-screen sheet.
 */
export const AiChatDock: React.FC = () => {
  const { t } = useI18n();
  const { open, visible } = useAiChat();
  const [width, setWidth] = useState(readWidth);
  const [dragging, setDragging] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  const persist = useCallback((w: number) => {
    try {
      localStorage.setItem(WIDTH_KEY, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;
      setDragging(true);
      const onMove = (ev: PointerEvent) => {
        const next = Math.min(
          MAX_W,
          Math.max(MIN_W, startW + (startX - ev.clientX)),
        );
        setWidth(next);
      };
      const onUp = () => {
        setDragging(false);
        persist(widthRef.current);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(
        MAX_W,
        Math.max(MIN_W, width + (e.key === "ArrowLeft" ? step : -step)),
      );
      setWidth(next);
      persist(next);
    }
  };

  const wide = width >= 560;
  const toggleWide = useCallback(() => {
    const next = widthRef.current >= 560 ? DEFAULT_W : WIDE_W;
    setWidth(next);
    persist(next);
  }, [persist]);

  if (!visible) return null;

  return (
    <div
      style={{ ["--ai-w" as string]: `${width}px` }}
      className={`${
        open
          ? "fixed inset-0 z-50 sm:static sm:z-auto sm:w-[var(--ai-w)] border-l border-m3-border"
          : "w-0 border-l-0"
      } h-full shrink-0 overflow-hidden relative ${
        dragging
          ? "select-none"
          : "sm:transition-[width] sm:duration-200 sm:ease-out"
      }`}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("ai.chat.resize")}
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          onDoubleClick={toggleWide}
          className="hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-10 cursor-col-resize hover:bg-m3-primary/30 focus-visible:bg-m3-primary/40 transition-colors"
        />
      )}
      <div className="h-full w-full sm:w-[var(--ai-w)]">
        {(open || everOpened) && (
          <Suspense fallback={null}>
            <AiChatPanel wide={wide} onToggleWide={toggleWide} />
          </Suspense>
        )}
      </div>
    </div>
  );
};
