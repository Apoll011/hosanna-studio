/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildPageCss,
  PRINT_DOCUMENT_CSS,
  PRINT_FONTS_URL,
} from "./printStyles";
import { PrintOptions } from "./types";

const IFRAME_ID = "hosana-print-iframe";
const READY_TIMEOUT_MS = 2500;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/** Resolves once web fonts and images inside the document have loaded. */
async function waitForAssets(doc: Document): Promise<void> {
  const images = Array.from(doc.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  const fonts = doc.fonts?.ready ?? Promise.resolve();
  await withTimeout(Promise.all([fonts, ...images]), READY_TIMEOUT_MS);
}

/**
 * Prints the rendered document in an isolated iframe. Only the print
 * stylesheet is shipped, so app-level styles can't leak into the PDF.
 */
export async function triggerPrint(
  element: HTMLElement,
  documentTitle: string,
  options: Pick<PrintOptions, "paperSize" | "margins" | "showPageNumbers">,
): Promise<void> {
  document.getElementById(IFRAME_ID)?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = IFRAME_ID;
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="${escapeHtml(document.documentElement.lang || "pt")}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
    <link rel="stylesheet" href="${PRINT_FONTS_URL}" />
    <style>
      ${buildPageCss(options)}
      html, body { margin: 0; padding: 0; background: #fff; }
      ${PRINT_DOCUMENT_CSS}
    </style>
  </head>
  <body>${element.innerHTML}</body>
</html>`);
  doc.close();

  await waitForAssets(doc);

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });

  try {
    win.focus();
    win.print();
    // Some browsers never fire afterprint for iframes.
    setTimeout(() => iframe.remove(), 60_000);
  } catch {
    iframe.remove();
    window.print();
  }
}
