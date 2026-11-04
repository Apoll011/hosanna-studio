/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spinner } from "@/src/components/common";
import { TranslationKey, useI18n } from "@/src/lib/i18n";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  LogOut,
  MailCheck,
  Moon,
  PlusCircle,
  Sun,
  XCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import bg from "../assets/images/background.webp";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAppNavigate } from "../hooks/useAppNavigate";
import { useSubscription } from "../hooks/useSubscription";
import { authClient } from "../lib/authClient";
import { posthog } from "../lib/posthog";
import {
  fetchPlanPricing,
  PLAN_PRICING,
  type PlanPricing,
} from "../lib/subscriptions";
import { GoogleTextField } from "./Login/components/GoogleTextField";
import { LanguageSelector } from "./Login/components/LanguageSelector";
import { WorkspaceSwitcher } from "./Login/components/WorkspaceSwitcher";

interface UserInvitation {
  id: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  expiresAt: Date;
  inviterId: string;
}

export const OnboardingPage: React.FC = () => {
  const { organization, hasAcceptedTrial, logout, refetch } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { navigate } = useAppNavigate();
  const [planPricing, setPlanPricing] = useState<PlanPricing>(PLAN_PRICING);
  useEffect(() => {
    void fetchPlanPricing().then(setPlanPricing);
  }, []);
  const { t, language } = useI18n();
  const { hasStarted, pendingAction, refresh, startCheckout } =
    useSubscription();
  const [mode, setMode] = useState<"choose" | "create" | "trial">("choose");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Check slug availability with debounce
  useEffect(() => {
    const trimmed = orgSlug.trim();
    if (!trimmed) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const { error } = await authClient.organization.checkSlug({
          slug: trimmed,
        });
        if (error) {
          setSlugStatus("taken");
        } else {
          setSlugStatus("available");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [orgSlug]);

  // Newly-created org, kept around just long enough to offer the trial step
  const [newOrg, setNewOrg] = useState<{ id: string; slug: string } | null>(
    null,
  );
  const [annual, setAnnual] = useState(false);

  // Invitations state
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [isFetchingInvitations, setIsFetchingInvitations] = useState(true);
  const [processingInvId, setProcessingInvId] = useState<string | null>(null);

  const fetchUserInvitations = useCallback(async () => {
    setIsFetchingInvitations(true);
    try {
      const res = await authClient.organization.listUserInvitations({
        query: {},
      });
      if (res.data) {
        const pendingInvs = (res.data as unknown as UserInvitation[]).filter(
          (inv) => inv.status === "pending",
        );
        setInvitations(pendingInvs);
      }
    } catch {
      // Ignore background invitation fetch error
    } finally {
      setIsFetchingInvitations(false);
    }
  }, []);

  useEffect(() => {
    // Check for a pending invitation token stored before sign-up/sign-in
    const pendingInvitationId = localStorage.getItem("pending_invitation_id");
    if (pendingInvitationId) {
      navigate(`/accept-invitation?id=${pendingInvitationId}`, {
        replace: true,
      });
      return;
    }

    fetchUserInvitations();
  }, [navigate, fetchUserInvitations]);

  // If the user already has an organization that has never accepted a trial /
  // set up billing (e.g. they created the org and refreshed, or they cancelled
  // at Stripe Checkout and got bounced back here), keep showing the trial step.
  useEffect(() => {
    if (organization && hasAcceptedTrial === false && !newOrg) {
      setNewOrg({ id: organization.id, slug: organization.slug });
      setMode("trial");
    }
  }, [organization, hasAcceptedTrial, newOrg]);

  // While the trial step is showing, poll for the subscription to appear
  useEffect(() => {
    if (mode !== "trial" || !newOrg) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    void refresh();
    return () => window.clearInterval(interval);
  }, [mode, newOrg, refresh]);

  useEffect(() => {
    if (mode === "trial" && newOrg && hasStarted === true) {
      void refetch();
    }
  }, [mode, newOrg, hasStarted, refetch]);

  const handleAcceptInvitation = async (invitationId: string) => {
    setProcessingInvId(invitationId);
    setErrorMsg("");
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        setErrorMsg(error.message || "Não foi possível aceitar o convite.");
        setProcessingInvId(null);
        return;
      }

      posthog.capture("invitation_accepted", { invitation_id: invitationId });
      await refetch();
      const orgData = data as {
        organization?: { slug?: string };
        slug?: string;
      } | null;
      const orgSlug = orgData?.organization?.slug || orgData?.slug;
      if (orgSlug) {
        localStorage.setItem("active_org_slug", orgSlug);
        await authClient.organization.setActive({ organizationSlug: orgSlug });
        navigate(`/${orgSlug}/folders`, { replace: true });
      } else {
        await fetchUserInvitations();
        setProcessingInvId(null);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Erro ao aceitar convite.");
      setProcessingInvId(null);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    setProcessingInvId(invitationId);
    setErrorMsg("");
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        setErrorMsg(error.message || "Não foi possível recusar o convite.");
        setProcessingInvId(null);
        return;
      }

      posthog.capture("invitation_rejected", { invitation_id: invitationId });
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Erro ao recusar convite.");
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    const slug = orgSlug.trim();
    const { data, error } = await authClient.organization.create({
      name: orgName.trim(),
      slug: slug,
    });

    if (error) {
      setIsLoading(false);
      setErrorMsg(error.message || "Falha ao criar a organização.");
      return;
    }

    posthog.capture("organization_created");
    localStorage.setItem("active_org_slug", slug);
    await authClient.organization.setActive({
      organizationSlug: slug,
    });

    await refetch();
    setIsLoading(false);

    const orgId = (data as { id?: string } | null)?.id;
    if (orgId) {
      setNewOrg({ id: orgId, slug });
      setMode("trial");
    }
  };

  const handleStartTrial = async () => {
    if (!newOrg) return;
    setErrorMsg("");
    posthog.capture("onboarding_trial_started", { annual });
    const origin = window.location.origin;
    const { error } = await startCheckout({
      annual,
      locale: language,
      successUrl: `${origin}/${newOrg.slug}/organization?tab=billing&billing=success`,
      cancelUrl: `${origin}/${newOrg.slug}/folders`,
    });
    if (error) {
      setErrorMsg(error);
    }
  };

  const getHeaderTitle = () => {
    if (mode === "create") return t("onboarding.createOrgTab");
    if (mode === "trial") return t("onboarding.trial.title");
    return "Hosanna Studio";
  };

  const getHeaderSubtitle = () => {
    if (mode === "create") return t("onboarding.step1Desc");
    if (mode === "trial") return t("onboarding.trial.desc");
    if (mode === "choose") return t("onboarding.step1Desc");
    return undefined;
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden font-sans text-m3-text antialiased selection:bg-m3-primary/20">
      {/* Dynamic Ambient Background Image with smooth subtle overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src={bg}
          alt="Background"
          className="w-full h-full object-cover scale-105 opacity-35 dark:opacity-25 transition-all duration-700 blur-[3px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-linear-to-b from-m3-bg/70 via-m3-bg/85 to-m3-sidebar/95 dark:from-m3-bg/85 dark:via-m3-bg/92 dark:to-m3-bg/98 transition-colors duration-500" />
      </div>

      {/* Top action header */}
      <header className="w-full px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 select-none px-3 py-1.5 rounded-full bg-m3-card/70 backdrop-blur-md border border-m3-border/60 shadow-xs">
            <img
              src="/favicon.png"
              alt="Hosanna Studio"
              className="w-5 h-5 object-contain rounded-md"
            />
            <span className="font-semibold text-xs sm:text-sm tracking-tight text-m3-text">
              Hosanna Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WorkspaceSwitcher />
          <LanguageSelector />
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label="Alternar tema"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-m3-card/70 backdrop-blur-md border border-m3-border/60 text-m3-secondary hover:bg-m3-card dark:hover:bg-m3-hover active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-m3-secondary" />
            )}
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 w-full flex items-center justify-center p-2 sm:p-3 md:p-4 z-10">
        <div className="w-full max-w-md sm:max-w-124 md:max-w-135 bg-m3-card/95 backdrop-blur-xl sm:border sm:border-m3-border/80 rounded-[var(--radius-xl)] sm:rounded-[28px] shadow-lg shadow-black/5 dark:shadow-black/40 px-6 py-4 sm:p-6 md:p-8 transition-all">
          {/* Header Brand & Titles */}
          <div className="flex flex-col items-center text-center mb-7 sm:mb-8 select-none">
            <h1 className="text-title text-m3-text">{getHeaderTitle()}</h1>

            {getHeaderSubtitle() && (
              <p className="mt-1.5 text-muted max-w-sm">
                {getHeaderSubtitle()}
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-[var(--radius-md)] bg-m3-danger/10 border border-m3-danger/30 text-m3-danger text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-m3-danger" />
              <span className="flex-1 leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Mode: Trial */}
          {mode === "trial" && newOrg && (
            <div className="text-center space-y-5">
              <div className="bg-m3-sidebar/60 border border-m3-border/60 rounded-[var(--radius-lg)] p-4 text-left space-y-2.5">
                {(
                  [
                    "onboarding.trial.features.sync",
                    "onboarding.trial.features.unlimited",
                    "onboarding.trial.features.print",
                    "onboarding.trial.features.backups",
                  ] as TranslationKey[]
                ).map((key) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-m3-primary shrink-0" />
                    <span className="text-sm text-m3-text">{t(key)}</span>
                  </div>
                ))}
              </div>

              {/* Billing interval choice */}
              <div className="bg-m3-sidebar/60 border border-m3-border/60 rounded-[var(--radius-lg)] p-3">
                <div className="flex items-center gap-2 bg-m3-card border border-m3-border rounded-full p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setAnnual(false)}
                    disabled={pendingAction === "checkout"}
                    className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      !annual
                        ? "bg-m3-primary text-white shadow-xs"
                        : "text-m3-secondary"
                    }`}
                  >
                    {t("settings.billing.monthly")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnual(true)}
                    disabled={pendingAction === "checkout"}
                    className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      annual
                        ? "bg-m3-primary text-white shadow-xs"
                        : "text-m3-secondary"
                    }`}
                  >
                    {t("settings.billing.annual")}
                  </button>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-semibold text-m3-text">
                    {annual
                      ? planPricing.annual.amount
                      : planPricing.monthly.amount}
                  </span>
                  <span className="text-xs sm:text-sm text-m3-secondary">
                    {annual
                      ? planPricing.annual.period
                      : planPricing.monthly.period}
                  </span>
                </div>
                {annual && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 text-center flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {t("settings.billing.annualSavings")}
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                className="w-full rounded-full"
                isLoading={pendingAction === "checkout"}
                disabled={pendingAction === "checkout"}
                icon={<CreditCard className="w-4 h-4" />}
                onClick={handleStartTrial}
              >
                {t("onboarding.trial.startBtn")}
              </Button>
              <p className="text-xs text-m3-secondary">
                {t("onboarding.trial.note")}
              </p>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex items-center text-xs sm:text-sm font-medium text-m3-secondary hover:text-m3-text transition-colors gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t("sidebar.logout")}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode: Choose */}
          {mode === "choose" && (
            <div className="space-y-6">
              {/* Section: Pending Invitations */}
              {isFetchingInvitations ? (
                <div className="flex items-center justify-center p-4">
                  <Spinner
                    size="sm"
                    label={t("settings.members.loadingInvites")}
                  />
                </div>
              ) : invitations.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <MailCheck className="w-4 h-4 text-m3-primary" />
                    <h3 className="text-label">
                      {t("settings.members.pendingInvites", {
                        count: invitations.length,
                      })}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {invitations.map((inv) => {
                      const isProcessing = processingInvId === inv.id;
                      return (
                        <div
                          key={inv.id}
                          className="p-4 bg-m3-primary/5 border border-m3-primary/25 rounded-[var(--radius-lg)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-m3-primary" />
                              <span className="font-semibold text-m3-text text-sm">
                                {inv.organizationName || inv.organizationId}
                              </span>
                            </div>
                            <p className="text-xs text-m3-secondary">
                              {t("settings.account.profile.role")}:{" "}
                              <span className="font-medium text-m3-text capitalize">
                                {inv.role}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleRejectInvitation(inv.id)}
                              className="h-8 px-3 rounded-full border border-m3-border text-m3-text hover:bg-m3-danger/10 hover:text-m3-danger transition-colors text-xs font-medium cursor-pointer"
                            >
                              {t("auth.acceptInvitation.rejectBtn")}
                            </button>
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={isProcessing}
                              disabled={isProcessing}
                              onClick={() => handleAcceptInvitation(inv.id)}
                              className="rounded-full"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              {t("auth.acceptInvitation.acceptBtn")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Action options */}
              <div className="space-y-3">
                {invitations.length > 0 && (
                  <h3 className="text-label px-1">Outras Opções</h3>
                )}

                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className="w-full flex items-center p-4 border border-m3-border hover:border-m3-primary rounded-[var(--radius-lg)] transition-all group text-left bg-transparent hover:bg-m3-hover cursor-pointer"
                >
                  <div className="w-10 h-10 bg-m3-primary/10 text-m3-primary rounded-full flex items-center justify-center mr-3.5 transition-colors">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-m3-text text-sm">
                      {t("onboarding.createOrgTab")}
                    </h3>
                    <p className="text-xs text-m3-secondary">
                      {t("onboarding.step1Desc")}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-m3-secondary group-hover:text-m3-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex items-center text-xs sm:text-sm font-medium text-m3-secondary hover:text-m3-text transition-colors gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t("sidebar.logout")}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode: Create */}
          {mode === "create" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <GoogleTextField
                label={t("onboarding.orgNameLabel")}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
              />

              <GoogleTextField
                label={t("onboarding.slugLabel")}
                value={orgSlug}
                onChange={(e) =>
                  setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
                required
                error={
                  slugStatus === "taken" ? t("onboarding.slugTaken") : undefined
                }
                helperText={
                  slugStatus === "checking"
                    ? t("onboarding.checkingSlug")
                    : slugStatus === "available"
                      ? t("onboarding.slugAvailable")
                      : "hosanna.app/slug"
                }
                trailingIcon={
                  slugStatus === "checking" ? (
                    <Spinner size="sm" />
                  ) : slugStatus === "available" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : slugStatus === "taken" ? (
                    <XCircle className="w-4 h-4 text-m3-danger" />
                  ) : undefined
                }
              />

              <div className="flex items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-m3-secondary hover:text-m3-text py-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t("common.back")}</span>
                </button>

                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !orgName.trim() ||
                    !orgSlug.trim() ||
                    slugStatus !== "available"
                  }
                  isLoading={isLoading}
                  className="rounded-full px-6"
                >
                  {t("onboarding.createOrgBtn")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-135 mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-m3-secondary shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span>Hosanna Studio &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="hover:text-m3-text transition-colors"
          >
            Ajuda
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="hover:text-m3-text transition-colors"
          >
            Privacidade
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="hover:text-m3-text transition-colors"
          >
            Termos
          </a>
        </div>
      </footer>
    </div>
  );
};
