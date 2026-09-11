/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Spinner } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import React, { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isDemoMode } from "../demo/index";
import { MainLayout } from "../layouts/MainLayout";
import { usePreloadPermissions } from "../lib/permissions/client";
import { CaptchaPage } from "../pages/CaptchaPage";
import { ProtectedRoute } from "./ProtectedRoute";

const PageLoader = () => {
  const { t } = useI18n();
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-m3-bg">
      <Spinner size="lg" label={t("common.loading")} />
    </div>
  );
};

import {
  AcceptInvitationPage,
  AgendaPage,
  CollectionDetailPage,
  CollectionsPage,
  DemoPage,
  FoldersPage,
  ForgotPasswordPage,
  LoginPage,
  OnboardingPage,
  RegisterOrganizationPage,
  RegisterPage,
  ResetPasswordPage,
  ServiceDetailPage,
  ServicesPage,
  SettingsPage,
  SongEditorPage,
  SongsPage,
  TeamsPage,
  TrashPage,
  TwoFactorPage,
  VerifyEmailPage,
  prefetchQueue,
} from "./routePreloader";

function canPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !["slow-2g", "2g"].includes(connection.effectiveType || "");
}

function runWhenIdle(cb: () => void, timeout = 2000) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 1);
  }
}

function prefetchRemainingRoutes() {
  if (!canPrefetch()) return;

  let i = 0;
  const step = () => {
    if (i >= prefetchQueue.length) return;
    const importFn = prefetchQueue[i++];
    importFn().catch(() => {});
    runWhenIdle(step);
  };

  runWhenIdle(step);
}

const ErrorFallback = ({
  resetErrorBoundary,
}: {
  resetErrorBoundary: () => void;
}) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h2 className="text-xl font-bold mb-2">
        {t("routes.errorBoundary.title")}
      </h2>
      <p className="text-gray-500 mb-4">{t("routes.errorBoundary.desc")}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
      >
        {t("routes.errorBoundary.reloadBtn")}
      </button>
    </div>
  );
};

const OrganizationGuard = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { organization, isLoading } = useAuth();

  // Demo mode — the org slug is always "demo"; allow through without redirect.
  if (isDemoMode()) return <Outlet />;

  if (isLoading) return <PageLoader />;

  if (!organization) {
    return <Navigate to="/onboarding" replace />;
  }

  if (slug && slug !== organization.slug) {
    const correctPathname = location.pathname.replace(
      new RegExp(`^/${slug}`),
      `/${organization.slug}`,
    );

    return (
      <Navigate
        to={`${correctPathname}${location.search}${location.hash}`}
        replace
      />
    );
  }

  return <Outlet />;
};

export const AppRoutes: React.FC = () => {
  usePreloadPermissions();

  useEffect(() => {
    prefetchRemainingRoutes();
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/two-factor" element={<TwoFactorPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/new" element={<RegisterOrganizationPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/captcha" element={<CaptchaPage />} />

          {/* Demo mode entry point — no auth required */}
          <Route path="/demo" element={<DemoPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Wrap the slug routes with our new OrganizationGuard */}
            <Route path="/:slug" element={<OrganizationGuard />}>
              <Route element={<MainLayout />}>
                <Route index element={<Navigate to="folders" replace />} />
                <Route path="folders" element={<FoldersPage />} />
                <Route path="songs" element={<SongsPage hideHeader />} />
                <Route path="songs/:id" element={<SongEditorPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route
                  path="collections/:id"
                  element={<CollectionDetailPage />}
                />
                <Route path="services" element={<ServicesPage hideHeader />} />
                <Route path="services/:id" element={<ServiceDetailPage />} />
                <Route path="teams" element={<TeamsPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="trash" element={<TrashPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};
