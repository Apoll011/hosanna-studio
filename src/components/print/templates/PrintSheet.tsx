/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface PrintSheetProps {
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}

/** One printed page unit: body flexes, footer is pinned to the page bottom. */
export const PrintSheet: React.FC<PrintSheetProps> = ({
  children,
  footer,
  className = "",
}) => (
  <article className={`hp-sheet ${className}`.trim()}>
    <div className="hp-sheet-body">{children}</div>
    {footer}
  </article>
);
