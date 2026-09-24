/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppLink } from "@/src/components/AppLink";
import { Button, Spinner } from "@/src/components/common";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useI18n } from "@/src/lib/i18n";
import { posthog } from "@/src/lib/posthog";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { authClient } from "../../lib/authClient";
import LoginLayout from "./Layout";
import { GoogleTextField } from "./components/GoogleTextField";
import { PasswordStrengthMeter } from "./components/PasswordStrengthMeter";
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "./components/TurnstileWidget";

export const RegisterOrganizationPage: React.FC = () => {
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
  const beta_release = Boolean(posthog.isFeatureEnabled("beta-release"));

  // Step state
  const [step, setStep] = useState(1);

  // Form State
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<TurnstileHandle>(null);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const passwordMismatch =
    confirmPassword.length > 0 && adminPassword !== confirmPassword;

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

  // Validation per step
  const isStep1Valid =
    orgName.trim() !== "" &&
    orgSlug.trim() !== "" &&
    slugStatus === "available";
  const isStep2Valid = adminName.trim() !== "" && adminEmail.trim() !== "";
  const isStep3Valid =
    adminPassword.trim() !== "" &&
    adminPassword === confirmPassword &&
    agreedToTerms &&
    !!captchaToken;

  const handleNext = () => {
    setErrorMsg("");
    if (step === 1 && isStep1Valid) setStep(2);
    else if (step === 2 && isStep2Valid) setStep(3);
  };

  const handleBack = () => {
    setErrorMsg("");
    if (step > 1) setStep(step - 1);
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isStep3Valid) return;

    setErrorMsg("");
    setIsLoading(true);

    try {
      // 1. Sign up the admin user
      const { error: signUpError, data } = await authClient.signUp.email({
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        fetchOptions: captchaToken
          ? {
              headers: { "x-captcha-response": captchaToken },
            }
          : undefined,
      });

      if (signUpError)
        throw new Error(signUpError.message || "Falha ao criar conta.");

      // 2. Create the organization
      const { error: orgError } = await authClient.organization.create({
        name: orgName.trim(),
        slug: orgSlug.trim(),
        userId: data.user.id,
      });

      if (orgError)
        throw new Error(orgError.message || "Falha ao criar organização.");

      setIsLoading(false);
      setIsSuccess(true);

      setTimeout(() => {
        navigate("/login", {
          state: { message: "Organização criada! Já pode fazer login." },
          replace: true,
        });
      }, 2000);
    } catch (err: unknown) {
      setErrorMsg(
        (err as Error).message ||
          "Falha ao criar organização. Tente novamente.",
      );
      setIsLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (step === 1 && isStep1Valid) handleNext();
      if (step === 2 && isStep2Valid) handleNext();
      if (step === 3 && isStep3Valid) handleCreateSubmit();
    }
  };

  if (!beta_release) {
    return (
      <LoginLayout
        headerTitle={t("auth.tenant.title")}
        headerSubtitle={t("auth.tenant.beta")}
        optionalLink="/login"
        optionalMsg={t("auth.login.title")}
      >
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <AppLink
            to="/login"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all"
          >
            {t("auth.login.title")}
          </AppLink>
        </div>
      </LoginLayout>
    );
  }

  const getStepSubtitle = () => {
    if (step === 1) return t("onboarding.step1Desc");
    if (step === 2) return t("auth.register.subtitle");
    return t("auth.resetPassword.subtitle");
  };

  return (
    <LoginLayout
      headerTitle={t("onboarding.createOrgTab")}
      headerSubtitle={getStepSubtitle()}
      errorMsg={errorMsg}
    >
      {isSuccess ? (
        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {t("auth.resetPassword.successDesc")}
          </p>
        </div>
      ) : (
        <>
          {/* Step Progress Bar with Google Material Stepper design */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Passo {step} de 3</span>
              <span>
                {step === 1
                  ? t("settings.workspace.title")
                  : step === 2
                    ? t("settings.roles.admin")
                    : t("settings.tabs.account")}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-white/10 h-1 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          <form onKeyDown={handleKeyDown} className="space-y-4">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <GoogleTextField
                  label={t("onboarding.orgNameLabel")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
                <GoogleTextField
                  label={t("onboarding.slugLabel")}
                  value={orgSlug}
                  onChange={(e) =>
                    setOrgSlug(
                      e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    )
                  }
                  error={
                    slugStatus === "taken"
                      ? t("onboarding.slugTaken")
                      : undefined
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
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : undefined
                  }
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <GoogleTextField
                  label={t("auth.register.nameLabel")}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
                <GoogleTextField
                  type="email"
                  label={t("auth.register.emailLabel")}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <GoogleTextField
                  type={showPassword ? "text" : "password"}
                  label={t("auth.register.passwordLabel")}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />

                <GoogleTextField
                  type={showPassword ? "text" : "password"}
                  label={t("auth.register.confirmPasswordLabel")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  error={
                    passwordMismatch
                      ? t("auth.register.passwordMismatch")
                      : undefined
                  }
                />

                <div className="flex items-center justify-between px-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="w-4 h-4 rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-[#1e1f20] cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Mostrar palavra-passe
                    </span>
                  </label>
                </div>

                {adminPassword.length > 0 && (
                  <PasswordStrengthMeter password={adminPassword} />
                )}

                <TurnstileWidget ref={captchaRef} onVerify={setCaptchaToken} />

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="org-terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-[#1e1f20] cursor-pointer"
                  />
                  <label
                    htmlFor="org-terms"
                    className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-snug cursor-pointer select-none"
                  >
                    Concordo com os Termos de Serviço e a Política de
                    Privacidade.
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-3 pt-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <AppLink
                  to="/login"
                  className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline py-2"
                >
                  {t("auth.register.loginLink")}
                </AppLink>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                  className="h-10 sm:h-11 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-none border-0"
                >
                  {t("settings.twoFactor.continue")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCreateSubmit}
                  isLoading={isLoading}
                  disabled={!isStep3Valid || isLoading}
                  className="h-10 sm:h-11 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-none border-0"
                >
                  {t("onboarding.createOrgBtn")}
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </LoginLayout>
  );
};
