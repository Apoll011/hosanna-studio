/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppLink } from "@/src/components/AppLink";
import { Button } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import LoginLayout from "./Layout";

function humanizeError(code: string | null, fallback: string): string {
  if (!code) return fallback;
  const normalized = code.replace(/[_-]+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const AuthErrorPage: React.FC = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const errorMsg = useMemo(() => {
    const error =
      searchParams.get("error") ||
      searchParams.get("error_description") ||
      searchParams.get("message");
    return humanizeError(error, t("auth.error.generic"));
  }, [searchParams, t]);

  return (
    <LoginLayout
      headerTitle={t("auth.error.title")}
      headerSubtitle={t("auth.error.subtitle")}
      errorMsg={errorMsg}
    >
      <div className="space-y-4">
        <p className="text-body-sm text-m3-text-secondary">
          {t("auth.error.hint")}
        </p>
        <AppLink to="/login" className="block">
          <Button type="button" className="w-full">
            {t("auth.error.backToLogin")}
          </Button>
        </AppLink>
      </div>
    </LoginLayout>
  );
};
