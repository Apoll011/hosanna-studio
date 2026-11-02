/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PRINT_BRAND_ACCENT } from "./brand";
import { PAGE_MARGINS_MM, PAPER_SIZES } from "./options";
import { PrintOptions } from "./types";

/*
 * Print documents are styled by this sheet alone (no Tailwind), so the exact
 * same markup renders identically in the on-screen preview and inside the
 * isolated print iframe. Every size is in `em` off `--hp-font-size`, which
 * makes the user's font-size choice scale the whole page consistently.
 */

export const PRINT_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&display=swap";

export const PRINT_DOCUMENT_CSS = /* css */ `
.hp-doc {
  --hp-sans: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --hp-serif: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --hp-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --hp-accent: ${PRINT_BRAND_ACCENT};
  --hp-ink: #1a1d24;
  --hp-text: #1a1d24;
  --hp-muted: #5c6570;
  --hp-faint: #94a3b8;
  --hp-rule: #d0d7e0;
  --hp-soft: #eef1f4;
  --hp-tint: #e0f2fe;
  --hp-chord: #0369a1;
  --hp-footer-space: 2.4em;
  --hp-body-font: var(--hp-sans);
  --hp-display-font: var(--hp-sans);
  --hp-chord-font: var(--hp-sans);

  --hp-lh: 1.3;
  --hp-chord-lh: 1.05;
  --hp-line-gap: 0.04em;
  --hp-stanza-gap: 0.5em;
  --hp-section-gap: 0.75em;
  --hp-block-gap: 0.9em;
  --hp-cell-y: 0.34em;

  font-family: var(--hp-body-font);
  font-size: var(--hp-font-size, 13px);
  line-height: var(--hp-lh);
  color: var(--hp-text);
  background: #fff;
  text-align: left;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-kerning: normal;
}
:where(.hp-doc) *, :where(.hp-doc) *::before, :where(.hp-doc) *::after { box-sizing: border-box; }
:where(.hp-doc) :where(h1, h2, h3, p, ol, ul, dl, dd, figure, pre) {
  margin: 0; padding: 0; font: inherit; color: inherit;
}
:where(.hp-doc) :where(ol, ul) { list-style: none; }
:where(.hp-doc) img { display: block; max-width: 100%; }

.hp-density-tight {
  --hp-lh: 1.2; --hp-chord-lh: 1; --hp-line-gap: 0em; --hp-stanza-gap: 0.35em;
  --hp-section-gap: 0.45em; --hp-block-gap: 0.6em; --hp-cell-y: 0.2em;
}
.hp-density-relaxed {
  --hp-lh: 1.45; --hp-chord-lh: 1.1; --hp-line-gap: 0.14em; --hp-stanza-gap: 0.7em;
  --hp-section-gap: 1.15em; --hp-block-gap: 1.3em; --hp-cell-y: 0.5em;
}
/* ── Sheets & page flow ───────────────────────────────────────────
 * With page-breaks on, each sheet is at least one page tall so the
 * footer can sit on the page bottom (margin-top: auto) when content
 * is short. The body flexes into the leftover space; two-column songs
 * fill that box so column 1 never runs into the footer before wrapping. */
.hp-sheet {
  display: flex; flex-direction: column; box-sizing: border-box;
}
.hp-sheet-body {
  flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0;
}
.hp-breaks > .hp-sheet {
  min-height: calc(var(--hp-paper-h) - 2 * var(--hp-margin));
}
.hp-breaks > .hp-sheet:not(:last-child) { break-after: page; }
.hp-doc:not(.hp-breaks) > .hp-sheet + .hp-sheet {
  margin-top: 1.4em; padding-top: 1.1em; border-top: 1px dashed var(--hp-rule);
}

/* ── Header ─────────────────────────────────────────────────────── */
.hp-header {
  display: flex; align-items: flex-start; gap: 0.75em;
  margin-bottom: var(--hp-block-gap); padding-bottom: 0.55em;
  border-bottom: 1px solid var(--hp-rule);
  break-inside: avoid; break-after: avoid;
}
.hp-logo { height: 2.3em; width: auto; max-width: 6em; object-fit: contain; flex-shrink: 0; }
.hp-header-main { flex: 1; min-width: 0; }
.hp-church {
  font-size: 0.72em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--hp-accent); margin-bottom: 0.15em;
}
.hp-title {
  font-family: var(--hp-display-font); font-size: 1.75em; font-weight: 700;
  line-height: 1.12; letter-spacing: -0.015em; color: var(--hp-ink); text-wrap: balance;
}
.hp-subtitle { font-size: 0.88em; color: var(--hp-muted); margin-top: 0.2em; font-weight: 500; }
.hp-badge {
  flex-shrink: 0; font-size: 0.74em; font-weight: 600; color: var(--hp-text);
  padding: 0.25em 0.75em; border-radius: 999px; border: 1px solid var(--hp-rule);
  background: var(--hp-soft); white-space: nowrap;
}

/* ── Song metadata ──────────────────────────────────────────────── */
.hp-meta {
  display: flex; flex-wrap: wrap; gap: 0.35em; margin: calc(var(--hp-block-gap) * -0.4) 0 var(--hp-block-gap);
  font-size: 0.78em; break-after: avoid;
}
.hp-meta-item {
  display: inline-flex; gap: 0.35em; align-items: baseline;
  padding: 0.15em 0.6em; border-radius: 999px; background: var(--hp-soft); border: 1px solid var(--hp-rule);
}
.hp-meta-label { color: var(--hp-muted); font-weight: 500; }
.hp-meta-value { color: var(--hp-ink); font-weight: 700; }

/* ── Song body ──────────────────────────────────────────────────── */
.hp-song { font-size: 1em; }
.hp-cols-2 {
  column-count: 2; column-gap: 2em;
  /* Grow into the leftover height in .hp-sheet-body (below header/meta,
   * above the footer). That gives columns a definite box so col 1
   * stops before the footer and then wraps to col 2. Long songs still
   * grow the sheet via the default min-height:auto content minimum. */
  flex: 1 1 auto;
  column-fill: auto;
}
.hp-section { break-inside: avoid; }
.hp-section + .hp-section { margin-top: var(--hp-section-gap); }
.hp-section-label {
  display: flex; align-items: baseline; gap: 0.45em;
  font-size: 0.7em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--hp-muted); margin-bottom: 0.2em; break-after: avoid;
}
.hp-repeat {
  font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--hp-accent);
}
.hp-line { line-height: var(--hp-lh); }
.hp-line + .hp-line { margin-top: var(--hp-line-gap); }
.hp-line--chords { display: flex; flex-wrap: wrap; align-items: flex-end; }
.hp-seg { display: inline-flex; flex-direction: column; justify-content: flex-end; }
.hp-chord {
  font-family: var(--hp-chord-font); font-size: 0.86em; font-weight: 700;
  line-height: var(--hp-chord-lh); color: var(--hp-chord); padding-right: 0.3em; white-space: pre;
}
.hp-lyric { white-space: break-spaces; }
.hp-gap { height: var(--hp-stanza-gap); }
.hp-section--chorus .hp-section-body { font-weight: 500; }
.hp-section--chorus .hp-section-label { color: var(--hp-accent); }
.hp-section--ref .hp-section-label { margin-bottom: 0; }
.hp-ref-note { font-style: italic; text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--hp-faint); }
.hp-comment { font-size: 0.85em; font-style: italic; color: var(--hp-muted); }
.hp-section--comment { font-size: 0.85em; font-style: italic; color: var(--hp-muted); }
.hp-callout {
  display: inline-block; font-size: 0.82em; font-weight: 600; margin: 0.15em 0;
  padding: 0.2em 0.6em; border-left: 3px solid #f59e0b; background: #fffbeb; color: #78350f;
}
.hp-callout--warning { border-color: #ef4444; background: #fef2f2; color: #7f1d1d; }
.hp-callout--success { border-color: #10b981; background: #ecfdf5; color: #064e3b; }
.hp-callout--tip { border-color: #0ea5e9; background: #f0f9ff; color: #0c4a6e; }
.hp-tab {
  font-family: var(--hp-mono); font-size: 0.8em; line-height: 1.25; white-space: pre;
  padding: 0.4em 0.6em; border: 1px solid var(--hp-rule); border-radius: 4px; overflow: hidden;
}
.hp-grid-line { font-family: var(--hp-mono); font-size: 0.86em; display: flex; flex-wrap: wrap; gap: 0 0.7em; }
.hp-grid-line + .hp-grid-line { margin-top: 0.15em; }
.hp-bar { color: var(--hp-faint); font-weight: 700; }
.hp-measure { color: var(--hp-chord); font-weight: 700; }
.hp-divider { border-top: 1px dashed var(--hp-faint); margin: var(--hp-block-gap) 0; column-span: all; }

/* ── Generic blocks (services, events, songbooks) ───────────────── */
.hp-block + .hp-block { margin-top: var(--hp-block-gap); }
.hp-h2 {
  display: flex; align-items: baseline; justify-content: space-between; gap: 1em;
  font-size: 0.74em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--hp-ink); padding-bottom: 0.3em; margin-bottom: 0.3em; border-bottom: 1px solid var(--hp-rule);
  break-after: avoid;
}
.hp-h2-aside { font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--hp-muted); }
.hp-table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
.hp-table thead { display: table-header-group; }
.hp-table tr { break-inside: avoid; }
.hp-table th {
  text-align: left; font-size: 0.82em; font-weight: 600; color: var(--hp-muted);
  padding: var(--hp-cell-y) 0.5em; border-bottom: 1px solid var(--hp-rule); white-space: nowrap;
}
.hp-table td { padding: var(--hp-cell-y) 0.5em; vertical-align: top; border-bottom: 1px solid var(--hp-soft); }
.hp-table tr:last-child td { border-bottom: 0; }
.hp-table .hp-num { width: 2.2em; text-align: center; color: var(--hp-faint); font-variant-numeric: tabular-nums; }
.hp-table .hp-right { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hp-table .hp-center { text-align: center; }
.hp-table .hp-mono { font-family: var(--hp-mono); font-size: 0.92em; }
.hp-cell-title { font-weight: 600; color: var(--hp-ink); }
.hp-cell-sub { font-size: 0.9em; color: var(--hp-muted); margin-top: 0.05em; }
.hp-cell-quote { font-size: 0.9em; font-style: italic; color: var(--hp-muted); margin-top: 0.1em;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.hp-tag {
  display: inline-block; font-size: 0.85em; font-weight: 600; padding: 0.05em 0.5em; border-radius: 4px;
  background: var(--hp-soft); color: var(--hp-text); white-space: nowrap;
}
.hp-tag--song { background: var(--hp-tint); color: var(--hp-accent); }
.hp-tag--message { background: #f5f3ff; color: #6d28d9; }
.hp-tag--scripture { background: #fffbeb; color: #92400e; }
.hp-chip {
  display: inline-block; font-size: 0.92em; padding: 0.02em 0.5em; margin: 0.08em 0.25em 0.08em 0;
  border-radius: 4px; background: var(--hp-soft); border: 1px solid var(--hp-rule); color: var(--hp-ink);
}
.hp-dim { color: var(--hp-faint); font-style: italic; }
.hp-note {
  font-size: 0.88em; padding: 0.5em 0.75em; border-radius: 6px; background: var(--hp-soft);
  border: 1px solid var(--hp-rule); break-inside: avoid;
}
.hp-note-label { font-size: 0.8em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--hp-muted); margin-bottom: 0.15em; }
.hp-note p { white-space: pre-wrap; }
.hp-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(9em, 1fr)); gap: 0.5em 1em;
  font-size: 0.88em; padding: 0.55em 0.75em; border-radius: 6px; border: 1px solid var(--hp-rule); break-inside: avoid; }
.hp-fact dt { font-size: 0.78em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--hp-muted); }
.hp-fact dd { font-weight: 600; color: var(--hp-ink); }
.hp-empty { font-size: 0.88em; font-style: italic; color: var(--hp-muted); padding: 0.6em 0; text-align: center; }
.hp-toc { font-size: 0.92em; }
.hp-toc li { display: flex; align-items: baseline; gap: 0.5em; padding: var(--hp-cell-y) 0; break-inside: avoid; }
.hp-toc li + li { border-top: 1px solid var(--hp-soft); }
.hp-toc-num { width: 1.6em; color: var(--hp-faint); font-variant-numeric: tabular-nums; text-align: right; }
.hp-toc-title { font-weight: 600; color: var(--hp-ink); }
.hp-toc-dots { flex: 1; border-bottom: 1px dotted var(--hp-faint); transform: translateY(-0.25em); min-width: 1em; }
.hp-toc-type { font-size: 0.82em; color: var(--hp-muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* ── Footer ─────────────────────────────────────────────────────── */
.hp-footer {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25em 1em;
  margin-top: auto; padding-top: 0.4em; border-top: 1px solid var(--hp-rule);
  font-size: 0.68em; color: var(--hp-muted); break-inside: avoid; flex-shrink: 0;
  min-height: var(--hp-footer-space); box-sizing: border-box;
}
.hp-footer-left { display: flex; flex-wrap: wrap; gap: 0 0.9em; }

/* ═══ THEMES ═══════════════════════════════════════════════════════ */

/* Classic — liturgical serif, centred masthead, double rules. */
.hp-theme-classic { --hp-body-font: var(--hp-serif); --hp-display-font: var(--hp-serif); --hp-chord-font: var(--hp-sans); }
.hp-theme-classic .hp-header { flex-direction: column; align-items: center; text-align: center; gap: 0.3em; border-bottom: 3px double var(--hp-ink); }
.hp-theme-classic .hp-logo { filter: grayscale(1) contrast(1.15); height: 2.6em; }
.hp-theme-classic .hp-church { color: var(--hp-text); letter-spacing: 0.22em; font-weight: 600; }
.hp-theme-classic .hp-title { font-weight: 600; font-size: 1.85em; letter-spacing: 0; }
.hp-theme-classic .hp-subtitle { font-style: italic; }
.hp-theme-classic .hp-badge { background: none; border: 0; border-radius: 0; font-style: italic; font-weight: 400; color: var(--hp-muted); padding: 0; }
.hp-theme-classic .hp-meta { justify-content: center; font-style: italic; gap: 0 1.1em; }
.hp-theme-classic .hp-meta-item { background: none; border: 0; padding: 0; }
.hp-theme-classic .hp-meta-value { font-weight: 600; }
.hp-theme-classic .hp-section-label { font-style: italic; text-transform: none; letter-spacing: 0; font-size: 0.85em; font-weight: 600; color: var(--hp-text); }
.hp-theme-classic .hp-section--chorus .hp-section-body { font-style: italic; font-weight: 400; padding-left: 1.4em; }
.hp-theme-classic .hp-section--chorus .hp-section-label { padding-left: 1.6em; color: var(--hp-accent); }
.hp-theme-classic .hp-h2 { justify-content: center; border-bottom: 3px double var(--hp-rule); font-family: var(--hp-serif); letter-spacing: 0.14em; }
.hp-theme-classic .hp-table th { font-style: italic; font-weight: 600; border-bottom: 1px solid var(--hp-ink); }
.hp-theme-classic .hp-tag { background: none; padding: 0; font-style: italic; color: var(--hp-text); }
.hp-theme-classic .hp-footer { border-top: 3px double var(--hp-rule); font-style: italic; justify-content: center; text-align: center; }
.hp-theme-classic .hp-cols-2 { column-rule: 1px solid var(--hp-rule); }

/* Contemporary / Stage — big, bold, high contrast for music stands. */
.hp-theme-contemporary { --hp-chord: #000; --hp-ink: #000; --hp-text: #0a0a0a; --hp-chord-font: var(--hp-mono); }
.hp-theme-contemporary .hp-header { align-items: center; border-bottom: 3px solid #000; }
.hp-theme-contemporary .hp-logo { height: 2.6em; border: 1px solid #000; border-radius: 4px; }
.hp-theme-contemporary .hp-church { color: var(--hp-muted); letter-spacing: 0.14em; font-weight: 800; }
.hp-theme-contemporary .hp-title { font-size: 1.95em; font-weight: 800; text-transform: uppercase; letter-spacing: -0.01em; line-height: 1; }
.hp-theme-contemporary .hp-subtitle { text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; font-size: 0.78em; }
.hp-theme-contemporary .hp-badge { background: #000; color: #fff; border-color: #000; border-radius: 3px; font-family: var(--hp-mono); font-weight: 700; }
.hp-theme-contemporary .hp-meta { gap: 0; border: 2px solid #000; border-radius: 4px; width: fit-content; font-family: var(--hp-mono); font-size: 0.82em; }
.hp-theme-contemporary .hp-meta-item { background: none; border: 0; border-radius: 0; padding: 0.25em 0.8em; flex-direction: column; gap: 0; }
.hp-theme-contemporary .hp-meta-item + .hp-meta-item { border-left: 1px solid #000; }
.hp-theme-contemporary .hp-meta-label { font-size: 0.72em; text-transform: uppercase; font-weight: 700; }
.hp-theme-contemporary .hp-meta-value { font-size: 1.15em; }
.hp-theme-contemporary .hp-chord { font-size: 0.9em; font-weight: 700; }
.hp-theme-contemporary .hp-section-label { display: inline-flex; background: #000; color: #fff; padding: 0.1em 0.5em; border-radius: 2px; font-weight: 800; }
.hp-theme-contemporary .hp-section--chorus .hp-section-label { color: #fff; }
.hp-theme-contemporary .hp-repeat { color: #fff; }
.hp-theme-contemporary .hp-section--chorus .hp-section-body { font-weight: 700; border-left: 4px solid #000; padding-left: 0.6em; }
.hp-theme-contemporary .hp-section--ref .hp-section-label { background: none; color: #000; border: 1.5px solid #000; }
.hp-theme-contemporary .hp-section--ref .hp-repeat, .hp-theme-contemporary .hp-section--ref .hp-ref-note { color: #000; }
.hp-theme-contemporary .hp-h2 { border-bottom: 2px solid #000; font-weight: 800; font-family: var(--hp-mono); }
.hp-theme-contemporary .hp-table th { color: #000; font-family: var(--hp-mono); font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #000; }
.hp-theme-contemporary .hp-table td { border-bottom-color: #d4d4d4; }
.hp-theme-contemporary .hp-tag { background: none; border: 1px solid #000; color: #000; text-transform: uppercase; font-family: var(--hp-mono); font-size: 0.75em; }
.hp-theme-contemporary .hp-footer { border-top: 2px solid #000; font-family: var(--hp-mono); text-transform: uppercase; }

/* Compact — dense single-line masthead, minimal chrome to save paper. */
.hp-theme-compact .hp-header { align-items: baseline; gap: 0.5em; padding-bottom: 0.3em; }
.hp-theme-compact .hp-logo { height: 1.4em; align-self: center; }
.hp-theme-compact .hp-header-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.6em; }
.hp-theme-compact .hp-church { order: 3; margin: 0; font-size: 0.66em; color: var(--hp-muted); }
.hp-theme-compact .hp-title { font-size: 1.3em; }
.hp-theme-compact .hp-subtitle { margin: 0; font-size: 0.8em; }
.hp-theme-compact .hp-badge { font-size: 0.66em; padding: 0.1em 0.5em; border-radius: 3px; }
.hp-theme-compact .hp-meta { font-size: 0.72em; gap: 0 0.9em; margin-top: calc(var(--hp-block-gap) * -0.5); }
.hp-theme-compact .hp-meta-item { background: none; border: 0; padding: 0; }
.hp-theme-compact .hp-section-label { font-size: 0.64em; margin-bottom: 0.05em; }
.hp-theme-compact .hp-section--chorus .hp-section-body { border-left: 1.5px solid var(--hp-accent); padding-left: 0.5em; }
.hp-theme-compact .hp-cols-2 { column-gap: 1.4em; column-rule: 1px solid var(--hp-rule); }
.hp-theme-compact .hp-table { font-size: 0.84em; }
.hp-theme-compact .hp-footer { font-size: 0.62em; padding-top: 0.25em; }

/* Elegant — editorial: serif display, small-caps labels, accent hairline. */
.hp-theme-elegant { --hp-display-font: var(--hp-serif); }
.hp-theme-elegant .hp-header { flex-direction: column; gap: 0.1em; border-bottom: 0; padding-bottom: 0; position: relative; }
.hp-theme-elegant .hp-header::after { content: ""; display: block; width: 3em; height: 2px; background: var(--hp-accent); margin-top: 0.5em; }
.hp-theme-elegant .hp-logo { position: absolute; right: 0; top: 0; height: 2.4em; }
.hp-theme-elegant .hp-church { font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.12em; font-size: 0.85em; font-weight: 600; }
.hp-theme-elegant .hp-title { font-size: 2.1em; font-weight: 400; letter-spacing: -0.01em; }
.hp-theme-elegant .hp-subtitle { font-family: var(--hp-serif); font-style: italic; font-size: 0.95em; }
.hp-theme-elegant .hp-badge { order: -1; background: none; border: 0; padding: 0; font-size: 0.7em; letter-spacing: 0.12em; text-transform: uppercase; color: var(--hp-muted); }
.hp-theme-elegant .hp-meta { gap: 0 1.2em; margin-top: 0; }
.hp-theme-elegant .hp-meta-item { background: none; border: 0; padding: 0; }
.hp-theme-elegant .hp-meta-label { font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.08em; }
.hp-theme-elegant .hp-meta-value { color: var(--hp-accent); }
.hp-theme-elegant .hp-section-label { font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.1em; font-size: 0.95em; font-weight: 600; color: var(--hp-accent); }
.hp-theme-elegant .hp-section--chorus .hp-section-body { font-family: var(--hp-serif); font-style: italic; font-weight: 400; font-size: 1.04em; }
.hp-theme-elegant .hp-h2 { font-family: var(--hp-serif); font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.1em; font-size: 0.95em; font-weight: 600; color: var(--hp-accent); border-bottom-color: color-mix(in srgb, var(--hp-accent) 35%, #fff); }
.hp-theme-elegant .hp-table th { font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.06em; font-size: 0.9em; }
.hp-theme-elegant .hp-tag { background: none; padding: 0; color: var(--hp-accent); font-style: italic; font-weight: 500; }
.hp-theme-elegant .hp-footer { border-top-color: color-mix(in srgb, var(--hp-accent) 35%, #fff); }

/* Bulletin — church bulletin: accent band masthead, tinted tables. */
.hp-theme-bulletin .hp-header {
  align-items: center; border: 0; border-radius: 8px; padding: 0.7em 0.95em;
  background: var(--hp-accent); color: #fff;
}
.hp-theme-bulletin .hp-logo { background: #fff; border-radius: 6px; padding: 0.2em; height: 2.6em; }
.hp-theme-bulletin .hp-church { color: rgba(255,255,255,0.85); }
.hp-theme-bulletin .hp-title { color: #fff; font-size: 1.6em; }
.hp-theme-bulletin .hp-subtitle { color: rgba(255,255,255,0.85); }
.hp-theme-bulletin .hp-badge { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.55); color: #fff; }
.hp-theme-bulletin .hp-meta-item { background: var(--hp-tint); border-color: transparent; }
.hp-theme-bulletin .hp-meta-value { color: var(--hp-accent); }
.hp-theme-bulletin .hp-section-label { display: inline-flex; background: var(--hp-tint); color: var(--hp-accent); padding: 0.08em 0.55em; border-radius: 999px; }
.hp-theme-bulletin .hp-section--chorus .hp-section-body { background: var(--hp-tint); border-radius: 6px; padding: 0.3em 0.6em; }
.hp-theme-bulletin .hp-h2 { color: var(--hp-accent); border-bottom: 2px solid var(--hp-accent); }
.hp-theme-bulletin .hp-table th { background: var(--hp-accent); color: #fff; border: 0; }
.hp-theme-bulletin .hp-table th:first-child { border-top-left-radius: 5px; border-bottom-left-radius: 5px; }
.hp-theme-bulletin .hp-table th:last-child { border-top-right-radius: 5px; border-bottom-right-radius: 5px; }
.hp-theme-bulletin .hp-table td { border-bottom: 0; }
.hp-theme-bulletin .hp-table tbody tr:nth-child(even) td { background: var(--hp-tint); }
.hp-theme-bulletin .hp-note, .hp-theme-bulletin .hp-facts { background: var(--hp-tint); border-color: transparent; }
.hp-theme-bulletin .hp-footer { border-top: 2px solid var(--hp-accent); }

/* Lead sheet — musician chart: label gutter, mono chords, boxed metadata. */
.hp-theme-leadsheet { --hp-chord-font: var(--hp-mono); --hp-chord: var(--hp-ink); }
.hp-theme-leadsheet .hp-header { align-items: flex-end; border-bottom: 2px solid var(--hp-ink); }
.hp-theme-leadsheet .hp-title { font-size: 1.6em; font-weight: 800; }
.hp-theme-leadsheet .hp-church { color: var(--hp-muted); }
.hp-theme-leadsheet .hp-badge { border-radius: 3px; font-family: var(--hp-mono); background: none; border: 1.5px solid var(--hp-ink); }
.hp-theme-leadsheet .hp-meta { gap: 0; font-family: var(--hp-mono); }
.hp-theme-leadsheet .hp-meta-item { border-radius: 0; background: none; border: 1px solid var(--hp-ink); padding: 0.15em 0.7em; }
.hp-theme-leadsheet .hp-meta-item + .hp-meta-item { border-left: 0; }
.hp-theme-leadsheet .hp-meta-label { text-transform: uppercase; font-size: 0.85em; }
.hp-theme-leadsheet .hp-chord { font-weight: 700; }
.hp-theme-leadsheet .hp-section { display: grid; grid-template-columns: 4.6em minmax(0, 1fr); column-gap: 0.7em; }
.hp-theme-leadsheet .hp-section-label {
  grid-column: 1; display: block; text-align: right; margin: 0; padding-top: 0.15em;
  font-family: var(--hp-mono); font-size: 0.66em; color: var(--hp-ink); overflow-wrap: anywhere;
}
.hp-theme-leadsheet .hp-section-label .hp-repeat { display: block; color: var(--hp-muted); }
.hp-theme-leadsheet .hp-section-body { grid-column: 2; border-left: 1px solid var(--hp-rule); padding-left: 0.7em; }
.hp-theme-leadsheet .hp-section--chorus .hp-section-body { border-left: 3px solid var(--hp-ink); font-weight: 600; }
.hp-theme-leadsheet .hp-section--ref .hp-section-body { display: none; }
.hp-theme-leadsheet .hp-section--ref .hp-section-label { grid-column: 1 / -1; display: flex; padding-left: 7.4em; }
.hp-theme-leadsheet .hp-section--ref .hp-repeat { display: inline; }
.hp-theme-leadsheet .hp-h2 { font-family: var(--hp-mono); border-bottom: 2px solid var(--hp-ink); }
.hp-theme-leadsheet .hp-table th { font-family: var(--hp-mono); text-transform: uppercase; color: var(--hp-ink); border-bottom: 1.5px solid var(--hp-ink); }
.hp-theme-leadsheet .hp-tag { background: none; border: 1px solid var(--hp-rule); font-family: var(--hp-mono); font-size: 0.78em; }
.hp-theme-leadsheet .hp-footer { font-family: var(--hp-mono); border-top-color: var(--hp-ink); }

/* Hymnal — hymn book: centred serif, numbered stanzas, ornament. */
.hp-theme-hymnal { --hp-body-font: var(--hp-serif); --hp-display-font: var(--hp-serif); --hp-chord-font: var(--hp-sans); }
.hp-theme-hymnal .hp-header { flex-direction: column; align-items: center; text-align: center; gap: 0.1em; border-bottom: 0; padding-bottom: 0; }
.hp-theme-hymnal .hp-header::after { content: "\\2766"; color: var(--hp-accent); font-size: 0.95em; line-height: 1; margin-top: 0.35em; }
.hp-theme-hymnal .hp-logo { height: 2.2em; filter: grayscale(1); }
.hp-theme-hymnal .hp-church { color: var(--hp-muted); letter-spacing: 0.2em; font-weight: 600; }
.hp-theme-hymnal .hp-title { font-variant: small-caps; font-weight: 600; letter-spacing: 0.03em; font-size: 1.75em; }
.hp-theme-hymnal .hp-subtitle { font-style: italic; }
.hp-theme-hymnal .hp-badge { order: -1; background: none; border: 0; padding: 0; font-size: 1.5em; font-weight: 700; color: var(--hp-accent); }
.hp-theme-hymnal .hp-meta { justify-content: center; font-style: italic; gap: 0 1em; }
.hp-theme-hymnal .hp-meta-item { background: none; border: 0; padding: 0; }
.hp-theme-hymnal .hp-song { counter-reset: hp-stanza; width: fit-content; max-width: 100%; margin-inline: auto; padding-left: 1.6em; }
.hp-theme-hymnal .hp-song.hp-cols-2 { width: auto; }
.hp-theme-hymnal .hp-section { position: relative; }
.hp-theme-hymnal .hp-section--numbered { counter-increment: hp-stanza; }
.hp-theme-hymnal .hp-section--numbered .hp-section-label { display: none; }
.hp-theme-hymnal .hp-section--numbered::before {
  content: counter(hp-stanza); position: absolute; left: -1.6em; top: 0;
  font-weight: 700; color: var(--hp-accent); font-size: 0.95em;
}
.hp-theme-hymnal .hp-section-label { font-style: italic; text-transform: none; letter-spacing: 0; font-size: 0.85em; font-weight: 600; }
.hp-theme-hymnal .hp-section--chorus .hp-section-body { font-style: italic; font-weight: 400; padding-left: 1.2em; }
.hp-theme-hymnal .hp-section--chorus .hp-section-label { padding-left: 1.2em; }
.hp-theme-hymnal .hp-h2 { justify-content: center; font-variant: small-caps; text-transform: lowercase; letter-spacing: 0.12em; font-size: 0.95em; font-weight: 600; border-bottom: 0; }
.hp-theme-hymnal .hp-table th { font-style: italic; font-weight: 600; }
.hp-theme-hymnal .hp-tag { background: none; padding: 0; font-style: italic; }
.hp-theme-hymnal .hp-footer { justify-content: center; text-align: center; font-style: italic; border-top: 0; }
`;

/** Screen-only chrome: paper sheets, shadows and page guides for the preview. */
export const PRINT_SCREEN_CSS = /* css */ `
.hp-screen .hp-doc { background: transparent; }
.hp-screen .hp-doc.hp-breaks > .hp-sheet,
.hp-screen .hp-doc:not(.hp-breaks) {
  background: #fff; width: var(--hp-paper-w); min-height: var(--hp-paper-h);
  padding: var(--hp-margin); margin: 0 auto;
  box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.10);
  border-radius: 2px;
}
/* Preview sheets already pad to simulate @page margins, so drop the
 * print-only content-box min-height (padding is inside border-box). */
.hp-screen .hp-doc.hp-breaks > .hp-sheet {
  min-height: var(--hp-paper-h);
}
.hp-screen .hp-doc.hp-breaks > .hp-sheet + .hp-sheet { margin-top: 24px; }
.hp-screen .hp-doc.hp-breaks > .hp-sheet:not(:last-child) { break-after: auto; }
.hp-thumb .hp-doc { pointer-events: none; }
`;

const STYLE_ID = "hosana-print-styles";

/** Injects the print stylesheet into the app document once. */
export function ensurePrintStyles(): void {
  if (typeof document === "undefined") return;
  const css = PRINT_DOCUMENT_CSS + PRINT_SCREEN_CSS;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

export function buildPageCss(
  options: Pick<PrintOptions, "paperSize" | "margins" | "showPageNumbers">,
): string {
  const paper = PAPER_SIZES[options.paperSize];
  const margin = PAGE_MARGINS_MM[options.margins];
  const pageNumbers = options.showPageNumbers
    ? `@bottom-right { content: counter(page) " / " counter(pages); font: 500 8pt "Figtree", system-ui, sans-serif; color: #94a3b8; }`
    : "";
  return `@page { size: ${paper.w}mm ${paper.h}mm; margin: ${margin}mm; ${pageNumbers} }`;
}

/** Inline CSS variables that size the document for the chosen paper. */
export function documentStyleVars(
  options: Pick<
    PrintOptions,
    "fontSize" | "paperSize" | "margins" | "useAccentColor"
  >,
  _accentColor?: string,
): Record<string, string> {
  const paper = PAPER_SIZES[options.paperSize];
  return {
    "--hp-font-size": `${options.fontSize}px`,
    // Always the Hosana brand sky from index.css — never the workspace accent.
    "--hp-accent": options.useAccentColor ? PRINT_BRAND_ACCENT : "#1a1d24",
    "--hp-chord": options.useAccentColor ? "#0369a1" : "#1a1d24",
    "--hp-tint": options.useAccentColor ? "#e0f2fe" : "#eef1f4",
    "--hp-paper-w": `${paper.w}mm`,
    "--hp-paper-h": `${paper.h}mm`,
    "--hp-margin": `${PAGE_MARGINS_MM[options.margins]}mm`,
  };
}
