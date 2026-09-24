/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppLink } from "@/src/components/AppLink";
import { Button } from "@/src/components/common";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useI18n } from "@/src/lib/i18n";
import { Eye, EyeOff } from "lucide-react";
import React, { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { clearDemoData, isDemoMode } from "../../demo/index";
import { authClient } from "../../lib/authClient";
import { posthog } from "../../lib/posthog";
import LoginLayout from "./Layout";
import { GoogleTextField } from "./components/GoogleTextField";
import { SocialAuthButtons } from "./components/SocialAuthButtons";
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "./components/TurnstileWidget";

export const LoginPage: React.FC = () => {
  const { navigate } = useAppNavigate();
  const location = useLocation();
  const redirectMessage =
    (location.state as { message?: string })?.message || "";
  const { refetch } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const captchaRef = useRef<TurnstileHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t("auth.login.errorInvalidCredentials"));
      return;
    }
    if (!captchaToken) {
      setErrorMsg(t("auth.captcha.pending"));
      captchaRef.current?.show();
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    // If coming from a demo session, wipe demo data before signing in
    if (isDemoMode()) {
      localStorage.clear();
      await clearDemoData();
    }

    const { data, error } = await authClient.signIn.email({
      email: email.trim(),
      password,
      rememberMe,
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
      if (
        error.code === "TWO_FACTOR_REQUIRED" ||
        (error as { status?: number })?.status === 403
      ) {
        navigate("/two-factor");
        return;
      }
      setErrorMsg(error.message || t("auth.login.errorInvalidCredentials"));
      return;
    }

    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
      navigate("/two-factor");
      return;
    }

    posthog.capture("user_logged_in", { remember_me: rememberMe });
    await refetch();
    const activeSlug = localStorage.getItem("active_org_slug");
    if (activeSlug) {
      navigate(`/${activeSlug}/folders`, { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }
  };

  return (
    <LoginLayout
      headerTitle={t("auth.login.title")}
      headerSubtitle={t("auth.login.subtitle")}
      errorMsg={errorMsg}
      redirectMessage={redirectMessage}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <GoogleTextField
          type="email"
          label={t("auth.login.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />

        <div className="space-y-1.5">
          <GoogleTextField
            type={showPassword ? "text" : "password"}
            label={t("auth.login.passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            }
          />

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-[#1e1f20] cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {t("auth.login.rememberMe")}
              </span>
            </label>

            <AppLink
              to="/forgot-password"
              className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("auth.login.forgotPasswordLink")}
            </AppLink>
          </div>
        </div>

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

        {/* Action bar: Create Account on the left, Sign In on the right */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <AppLink
            to="/register"
            className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline py-2"
          >
            {t("auth.login.registerLink")}
          </AppLink>

          <Button
            type="submit"
            isLoading={isLoading}
            className="h-10 sm:h-11 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-none hover:shadow-xs active:scale-[0.98] border-0"
          >
            {t("auth.login.loginBtn")}
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
