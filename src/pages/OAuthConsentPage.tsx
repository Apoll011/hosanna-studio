/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiClient } from "@/src/api";
import { Button, Surface } from "@/src/components/common";
import { useAuth } from "@/src/contexts/AuthContext";
import { useI18n } from "@/src/lib/i18n";
import { Loader2, Shield } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

/**
 * MCP / OAuth 2.1 consent page.
 * Better Auth redirects here with the original authorize query string.
 * User accepts → POST /api/auth/oauth2/consent → redirect back to the MCP client.
 */
export const OAuthConsentPage: React.FC = () => {
  const { t } = useI18n();
  const { user, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthQuery = useMemo(() => searchParams.toString(), [searchParams]);
  const clientId = searchParams.get("client_id") ?? "MCP client";
  const scope = searchParams.get("scope") ?? "";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m3-bg">
        <Loader2 className="w-6 h-6 animate-spin text-m3-primary" />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`/oauth/consent?${oauthQuery}`);
    return <Navigate to={`/login?redirect=${next}`} replace />;
  }

  const submit = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Better Auth mounts under /api/auth; API client baseURL already ends with /api.
      const data = await getApiClient().request<{
        redirect: true;
        url: string;
      }>("/auth/oauth2/consent", {
        method: "POST",
        body: JSON.stringify({
          accept,
          oauth_query: oauthQuery,
          ...(scope ? { scope } : {}),
        }),
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(t("oauth.consent.genericError"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("oauth.consent.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-m3-bg p-4">
      <Surface className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-m3-primary/10 text-m3-primary flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-title text-m3-text">{t("oauth.consent.title")}</h1>
            <p className="text-sm text-m3-secondary mt-1">
              {t("oauth.consent.desc", { client: clientId })}
            </p>
          </div>
        </div>

        {scope && (
          <div className="rounded-[var(--radius-md)] border border-m3-border bg-m3-sidebar/40 px-3 py-2 text-xs text-m3-text">
            <span className="font-medium block mb-1">
              {t("oauth.consent.scopes")}
            </span>
            <code className="break-all">{scope}</code>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void submit(false)}
          >
            {t("oauth.consent.deny")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={busy}
            onClick={() => void submit(true)}
          >
            {t("oauth.consent.allow")}
          </Button>
        </div>
      </Surface>
    </div>
  );
};
