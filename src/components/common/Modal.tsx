/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Optional tour anchor, e.g. create-folder-modal */
  dataTour?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
  dataTour,
  footer,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  const [rendered, setRendered] = useState(isOpen);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      // Only steal focus when the modal opens — not on every parent re-render
      // (inline onClose identities would otherwise blur controlled inputs).
      if (!wasOpenRef.current) {
        requestAnimationFrame(() => panelRef.current?.focus());
      }
      wasOpenRef.current = true;
    } else {
      wasOpenRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!rendered) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-m3-bg/75 backdrop-blur-sm overscroll-contain transition-opacity duration-200 ease-in-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-tour={dataTour}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidthClasses[maxWidth]} bg-m3-card border border-m3-border rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col max-h-[min(90vh,720px)] outline-none transition-all duration-200 ease-in-out ${
          shown ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
        }`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-m3-border/50">
          <h2 id={titleId} className="text-title text-m3-text min-w-0 truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-m3-secondary hover:text-m3-text hover:bg-m3-hover rounded-[var(--radius-md)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-m3-border/50 bg-m3-sidebar/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
