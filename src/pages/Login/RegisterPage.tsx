/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppLink } from "@/src/components/AppLink";
import { Button } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { CheckCircle2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { clearDemoData, isDemoMode } from "../../demo/index";
import { authClient } from "../../lib/authClient";
import { posthog } from "../../lib/posthog";
import LoginLayout from "./Layout";
import { GoogleTextField } from "./components/GoogleTextField";
import { PasswordStrengthMeter } from "./components/PasswordStrengthMeter";
import { SocialAuthButtons } from "./components/SocialAuthButtons";
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "./components/TurnstileWidget";

export const RegisterPage: React.FC = () => {
  const { refetch } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<TurnstileHandle>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successState, setSuccessState] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg(
        t("settings.account.profile.invalidImage")
          ? "Por favor preencha todos os campos."
          : "Preencha todos os campos.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("auth.register.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t("settings.account.profile.passwordMinLength"));
      return;
    }
    if (!captchaToken) {
      setErrorMsg(t("auth.captcha.pending"));
      captchaRef.current?.show();
      return;
    }

    setIsLoading(true);

    // If coming from a demo session, wipe demo data before signing up
    if (isDemoMode()) {
      localStorage.clear();
      await clearDemoData();
    }

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      fetchOptions: captchaToken
        ? {
            headers: { "x-captcha-response": captchaToken },
          }
        : undefined,
    });
    setIsLoading(false);

    captchaRef.current?.reset();
    setCaptchaToken("");

    if (error) {
      setErrorMsg(error.message || "Falha ao realizar registo.");
      return;
    }

    posthog.capture("user_registered");
    await refetch();
    setSuccessState(true);
  };

  if (successState) {
    return (
      <LoginLayout
        headerTitle={t("auth.register.successTitle")}
        headerSubtitle={t("auth.register.successDesc")}
        optionalLink="/login"
        optionalMsg={t("auth.register.loginLink")}
      >
        <div className="py-4 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mb-4 flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <AppLink
            to="/login"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all"
          >
            {t("auth.register.loginLink")}
          </AppLink>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout
      headerTitle={t("auth.register.title")}
      headerSubtitle={t("auth.register.subtitle")}
      errorMsg={errorMsg}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <GoogleTextField
          label={t("auth.register.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          autoFocus
        />

        <GoogleTextField
          type="email"
          label={t("auth.register.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        {/* Password inputs: 2-column on larger screens, single column on small */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <GoogleTextField
            type={showPassword ? "text" : "password"}
            label={t("auth.register.passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <GoogleTextField
            type={showPassword ? "text" : "password"}
            label={t("auth.register.confirmPasswordLabel")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            error={
              passwordMismatch ? t("auth.register.passwordMismatch") : undefined
            }
          />
        </div>

        {/* Show password toggle checkbox */}
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

        {password.length > 0 && <PasswordStrengthMeter password={password} />}

        <TurnstileWidget
          ref={captchaRef}
          onVerify={(token) => {
            setCaptchaToken(token);
            setErrorMsg((msg) =>
              msg === t("auth.captcha.pending") ? "" : msg,
            );
          }}
          onExpire={() => setCaptchaToken("")}
          onError={() => setErrorMsg(t("auth.captcha.failed"))}
        />

        {/* Actions bar: Sign In instead on left, Next/Submit button on right */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <AppLink
            to="/login"
            className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline py-2"
          >
            {t("auth.register.loginLink")}
          </AppLink>

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!captchaToken}
            className="h-10 sm:h-11 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-none hover:shadow-xs active:scale-[0.98] border-0"
          >
            {t("auth.register.registerBtn")}
          </Button>
        </div>
      </form>

      <SocialAuthButtons
        onError={(err) => setErrorMsg(err)}
        disabled={isLoading}
      />
    </LoginLayout>
  );
};
