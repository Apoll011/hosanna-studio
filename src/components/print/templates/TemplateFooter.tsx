/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PrintBrand, PrintOptions } from "../types";

interface TemplateFooterProps {
  options: PrintOptions;
  brand: PrintBrand;
  ccli?: string;
  copyright?: string;
}

export const TemplateFooter: React.FC<TemplateFooterProps> = ({
  options,
  brand,
  ccli,
  copyright,
}) => {
  const note = options.customFooter.trim() || brand.churchName;

  return (
    <footer className="hp-footer">
      <div className="hp-footer-left">
        {note && <span>{note}</span>}
        {ccli && <span>CCLI {ccli}</span>}
        {copyright && <span>© {copyright}</span>}
      </div>
      <span>Hosana</span>
    </footer>
  );
};
