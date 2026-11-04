/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge, Button, Spinner } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import {
  fetchPlanPricing,
  PLAN_PRICING,
  type PlanPricing,
} from "@/src/lib/subscriptions";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Lock,
  RotateCcw,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscription } from "../../hooks/useSubscription";
import { posthog } from "../../lib/posthog";

export interface BillingTabProps {
  active: boolean;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

const PLAN_FEATURE_KEYS = [
  "settings.billing.plan.features.sync",
  "settings.billing.plan.features.unlimited",
  "settings.billing.plan.features.print",
  "settings.billing.plan.features.backups",
  "settings.billing.plan.features.support",
] as const;

export const BillingTab: React.FC<BillingTabProps> = ({
  active,
  showToast,
}) => {
  const { t, language } = useI18n();
  const { organization } = useAuth();
  const { granted: canManageBilling, loading: canManageLoading } =
    useCan("billing.manage");
  const { granted: canAccessBilling, loading: canAccessLoading } =
    useCan("billing.access");

  const {
    subscriptions,
    isLoading,
    error: fetchError,
    activeSubscription: activeSub,
    pendingAction,
    refresh,
    startCheckout,
    openBillingPortal,
    restore,
  } = useSubscription();

  const [annual, setAnnual] = useState(false);
  const [planPricing, setPlanPricing] = useState<PlanPricing>(PLAN_PRICING);

  // Keep the data fresh every time the tab is opened.
  useEffect(() => {
    if (active && organization) void refresh();
  }, [active, organization, refresh]);

  useEffect(() => {
    if (active) void fetchPlanPricing().then(setPlanPricing);
  }, [active]);

  if (!active) return null;

  if (canManageLoading || canAccessLoading || !organization) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-m3-secondary">
        <Spinner size="lg" label={t("settings.billing.loading")} />
      </div>
    );
  }

  if (!canAccessBilling) {
    return (
      <div className="max-w-4xl mx-auto w-full bg-m3-card border border-m3-border rounded-[var(--radius-xl)] p-8 text-center">
        <Lock className="w-8 h-8 text-m3-secondary mx-auto mb-3" />
        <h3 className="text-base font-bold text-m3-text">
          {t("settings.billing.noAccessTitle")}
        </h3>
        <p className="text-sm text-m3-secondary mt-1">
          {t("settings.billing.noAccessDesc")}
        </p>
      </div>
    );
  }

  const isLoadingInitial = isLoading && subscriptions === null;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const daysLeft = (end?: string | Date | null) => {
    if (!end) return 0;
    const diff = new Date(end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleStart = async () => {
    if (!canManageBilling || !organization) return;
    posthog.capture("billing_checkout_started", { annual });
    const { error } = await startCheckout({
      annual,
      locale: language,
      // If checkout is cancelled, keep the owner on the billing tab instead of
      // bouncing them back to the studio folders.
      cancelUrl: `${window.location.origin}/${organization.slug}/organization?tab=billing`,
    });
    if (error) {
      showToast?.(error, "error");
    }
    // On success the browser is redirected to Stripe Checkout.
  };

  const handlePortal = async () => {
    if (!canManageBilling) return;
    const { error } = await openBillingPortal();
    if (error) {
      showToast?.(error, "error");
    }
  };

  const handleRestore = async () => {
    if (!canManageBilling) return;
    const { error } = await restore();
    if (error) {
      showToast?.(error, "error");
    } else {
      showToast?.(t("settings.billing.restoreSuccess"), "success");
    }
  };

  // Stripe only grants the 14-day free trial once per organization: an org
  // that subscribed before (even if it later cancelled) is billed right away,
  // so the "free trial" wording below must not be shown to them.
  const usedTrial = (subscriptions ?? []).some(
    (s) =>
      Boolean(s.trialStart) || Boolean(s.trialEnd) || s.status === "trialing",
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-m3-card border border-m3-border rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-6 py-5 border-b border-m3-border/60 flex items-center justify-between bg-m3-sidebar/50">
          <div>
            <h3 className="text-lg font-bold text-m3-text flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-m3-primary" />
              {t("settings.billing.title")}
            </h3>
            <p className="text-sm text-m3-secondary mt-1">
              {t("settings.billing.desc")}
            </p>
          </div>
          {!canManageBilling && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              {t("settings.billing.readOnly")}
            </span>
          )}
        </div>

        <div className="p-6">
          {isLoadingInitial ? (
            <div className="flex items-center justify-center py-10">
              <Spinner label={t("settings.billing.loading")} />
            </div>
          ) : fetchError && subscriptions === null ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <AlertTriangle className="w-6 h-6 text-m3-danger" />
              <p className="text-sm text-m3-danger">{fetchError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : activeSub ? (
            <div className="space-y-5">
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={
                    activeSub.status === "trialing" ? "amber" : "emerald"
                  }
                  size="md"
                >
                  {activeSub.status === "trialing"
                    ? t("settings.billing.status.trialing")
                    : t("settings.billing.status.active")}
                </Badge>
                <span className="text-sm font-bold text-m3-text">
                  {t("settings.billing.planName")}
                </span>
                {activeSub.billingInterval && (
                  <span className="text-xs text-m3-secondary capitalize">
                    ·{" "}
                    {activeSub.billingInterval === "year"
                      ? t("settings.billing.annual")
                      : t("settings.billing.monthly")}
                  </span>
                )}
              </div>

              {/* Trial banner */}
              {activeSub.status === "trialing" && activeSub.trialEnd && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <strong className="font-bold">
                      {t("settings.billing.trialDaysLeft", {
                        days: daysLeft(activeSub.trialEnd),
                      })}
                    </strong>
                    <p className="mt-0.5 opacity-90">
                      {t("settings.billing.trialEndsOn", {
                        date: formatDate(activeSub.trialEnd),
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Cancel-at-period-end warning */}
              {activeSub.cancelAtPeriodEnd && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-m3-danger shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-700 dark:text-rose-400">
                      <strong className="font-bold">
                        {t("settings.billing.cancelingTitle")}
                      </strong>
                      <p className="mt-0.5 opacity-90">
                        {t("settings.billing.cancelingDesc", {
                          date: formatDate(activeSub.periodEnd),
                        })}
                      </p>
                    </div>
                  </div>
                  {canManageBilling && (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={pendingAction === "restore"}
                      onClick={() => void handleRestore()}
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                      className="shrink-0"
                    >
                      {t("settings.billing.restore")}
                    </Button>
                  )}
                </div>
              )}

              {/* Billing period info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 bg-m3-sidebar rounded-xl">
                  <span className="block text-label text-m3-secondary">
                    {t("settings.billing.currentPeriod")}
                  </span>
                  <span className="font-semibold text-m3-text">
                    {formatDate(activeSub.periodStart)} →{" "}
                    {formatDate(activeSub.periodEnd)}
                  </span>
                </div>
                <div className="p-3.5 bg-m3-sidebar rounded-xl">
                  <span className="block text-label text-m3-secondary">
                    {t("settings.billing.nextCharge")}
                  </span>
                  <span className="font-semibold text-m3-text">
                    {activeSub.cancelAtPeriodEnd
                      ? "—"
                      : formatDate(activeSub.periodEnd)}
                  </span>
                </div>
              </div>

              {canManageBilling && (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    isLoading={pendingAction === "portal"}
                    icon={<CreditCard className="w-4 h-4" />}
                    onClick={() => void handlePortal()}
                  >
                    {t("settings.billing.manage")}
                  </Button>
                  <p className="text-xs text-m3-secondary mt-2">
                    {t("settings.billing.manageDesc")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-m3-primary/20 dark:border-m3-primary/30 bg-m3-primary/5 dark:bg-m3-primary/10 rounded-[var(--radius-xl)] p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="text-base font-semibold text-m3-text">
                    {t("settings.billing.planName")}
                  </h4>
                  <p className="text-sm text-m3-secondary mt-1 max-w-sm">
                    {t("settings.billing.planDesc")}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-m3-card border border-m3-border rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setAnnual(false)}
                    disabled={pendingAction === "checkout"}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      !annual ? "bg-m3-primary text-white" : "text-m3-secondary"
                    }`}
                  >
                    {t("settings.billing.monthly")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnual(true)}
                    disabled={pendingAction === "checkout"}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      annual ? "bg-m3-primary text-white" : "text-m3-secondary"
                    }`}
                  >
                    {t("settings.billing.annual")}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-m3-text">
                  {annual
                    ? planPricing.annual.amount
                    : planPricing.monthly.amount}
                </span>
                <span className="text-sm text-m3-secondary">
                  {annual
                    ? planPricing.annual.period
                    : planPricing.monthly.period}
                </span>
              </div>
              {annual && (
                <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {t("settings.billing.annualSavings")}
                </p>
              )}

              <ul className="mt-4 space-y-2">
                {PLAN_FEATURE_KEYS.map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-2 text-sm text-m3-text"
                  >
                    <Check className="w-4 h-4 text-m3-primary shrink-0" />
                    {t(key)}
                  </li>
                ))}
              </ul>

              {canManageBilling ? (
                <div className="mt-6">
                  <Button
                    variant="primary"
                    className="w-full sm:w-auto"
                    isLoading={pendingAction === "checkout"}
                    onClick={() => void handleStart()}
                  >
                    {usedTrial
                      ? t("settings.billing.subscribe")
                      : t("settings.billing.startTrial")}
                  </Button>
                  <p className="text-xs text-m3-secondary mt-2">
                    {usedTrial
                      ? t("settings.billing.subscribeNote")
                      : t("settings.billing.trialNote")}
                  </p>
                  <p className="text-xs text-m3-secondary mt-1">
                    {t("settings.billing.promoHint")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-m3-secondary mt-6">
                  {t("settings.billing.askOwner")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
