/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { aiApi, type AiBillingResponse } from "@/src/api/ai";
import { Button } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export interface AiBillingCardProps {
  /** Bump after a successful save so the card refetches. */
  refreshKey?: number;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

function formatMoney(amount: string, currency: string): string {
  const symbol =
    currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${amount}`;
}

function formatFetchedAt(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const AiBillingCard: React.FC<AiBillingCardProps> = ({
  refreshKey = 0,
  showToast,
}) => {
  const { t, locale } = useI18n();
  const [data, setData] = useState<AiBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await aiApi.getBilling();
      setData(next);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("ai.settings.billing.loadError");
      setError(message);
      setData(null);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  let body: React.ReactNode = null;
  if (loading && !data) {
    body = (
      <div className="flex items-center gap-2 text-m3-secondary text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("ai.settings.billing.loading")}
      </div>
    );
  } else if (error) {
    body = <p className="text-sm text-m3-danger">{error}</p>;
  } else if (data?.supported === false) {
    const reasonMsg =
      data.reason === "not_configured"
        ? t("ai.settings.billing.notConfigured")
        : data.reason === "disabled_crypto"
          ? t("ai.settings.billing.cryptoMissing")
          : t("ai.settings.billing.unsupported");
    body = <p className="text-sm text-m3-secondary">{reasonMsg}</p>;
  } else if (data?.supported === true && data.kind === "balance") {
    const primary = data.balances[0];
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-caption text-m3-secondary">
              {t("ai.settings.billing.total")}
            </p>
            <p className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight text-m3-text mt-0.5">
              {primary
                ? formatMoney(primary.totalBalance, primary.currency)
                : "—"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              data.isAvailable
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
            }`}
          >
            {data.isAvailable
              ? t("ai.settings.billing.available")
              : t("ai.settings.billing.unavailable")}
          </span>
        </div>

        {primary ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-caption text-m3-secondary">
                {t("ai.settings.billing.granted")}
              </p>
              <p className="text-sm font-medium tabular-nums text-m3-text mt-0.5">
                {formatMoney(primary.grantedBalance, primary.currency)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-caption text-m3-secondary">
                {t("ai.settings.billing.toppedUp")}
              </p>
              <p className="text-sm font-medium tabular-nums text-m3-text mt-0.5">
                {formatMoney(primary.toppedUpBalance, primary.currency)}
              </p>
            </div>
          </div>
        ) : null}

        {data.balances.length > 1 ? (
          <ul className="space-y-1.5 pt-1 border-t border-m3-border/60">
            {data.balances.slice(1).map((b) => (
              <li
                key={b.currency}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-m3-secondary">{b.currency}</span>
                <span className="tabular-nums font-medium text-m3-text">
                  {formatMoney(b.totalBalance, b.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-caption text-m3-secondary">
          {t("ai.settings.billing.refreshedAt", {
            time: formatFetchedAt(data.fetchedAt, locale),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-m3-border bg-m3-sidebar/40 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-3.5 py-3 border-b border-m3-border/80">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-m3-text">
              {t("ai.settings.billing.title")}
            </h3>
            <p className="text-caption text-m3-secondary mt-0.5">
              {t("ai.settings.billing.desc")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={t("ai.settings.billing.refresh")}
          isLoading={loading}
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={() => void load()}
          disabled={loading}
        />
      </div>

      <div className="px-3.5 py-4">{body}</div>
    </div>
  );
};
