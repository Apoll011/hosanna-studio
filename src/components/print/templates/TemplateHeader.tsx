/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PrintBrand, PrintOptions } from "../types";

interface TemplateHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  options: PrintOptions;
  brand: PrintBrand;
}

export const TemplateHeader: React.FC<TemplateHeaderProps> = ({
  title,
  subtitle,
  badge,
  options,
  brand,
}) => {
  const church = options.showChurchHeader
    ? brand.churchName || brand.churchShortName
    : undefined;
  const logo =
    options.showChurchHeader && options.showChurchLogo
      ? brand.churchLogo
      : null;

  return (
    <header className="hp-header">
      {logo && <img className="hp-logo" src={logo} alt="" />}
      <div className="hp-header-main">
        {church && <div className="hp-church">{church}</div>}
        <h1 className="hp-title">{title}</h1>
        {subtitle && <div className="hp-subtitle">{subtitle}</div>}
      </div>
      {badge && <div className="hp-badge">{badge}</div>}
    </header>
  );
};
