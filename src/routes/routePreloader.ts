import React, { lazy } from "react";

export type LazyImportFn<T> = () => Promise<{
  default: React.ComponentType<T>;
}>;

export interface LazyPreloadableComponent<T> extends React.LazyExoticComponent<
  React.ComponentType<T>
> {
  preload: () => Promise<{ default: React.ComponentType<T> }>;
}

export const prefetchQueue: Array<() => Promise<unknown>> = [];

export const lazyImport = <T>(
  componentImport: LazyImportFn<T>,
): LazyPreloadableComponent<T> => {
  prefetchQueue.push(componentImport);

  let cachedPromise: Promise<{ default: React.ComponentType<T> }> | null = null;

  const load = () => {
    if (!cachedPromise) {
      cachedPromise = (async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
          window.localStorage.getItem("page-force-refreshed") || "false",
        );

        try {
          const component = await componentImport();
          if (pageHasAlreadyBeenForceRefreshed) {
            window.localStorage.setItem("page-force-refreshed", "false");
          }
          return component;
        } catch (error) {
          if (!pageHasAlreadyBeenForceRefreshed) {
            window.localStorage.setItem("page-force-refreshed", "true");
            window.location.reload();
            return new Promise<never>(() => {});
          }
          throw error;
        }
      })();
    }
    return cachedPromise;
  };

  const LazyComp = lazy(load) as LazyPreloadableComponent<T>;
  LazyComp.preload = load;

  return LazyComp;
};

// ----------------------------------------------------------------------
// ROUTE COMPONENTS
// ----------------------------------------------------------------------
export const LoginPage = lazyImport(() =>
  import("../pages/Login/LoginPage").then((m) => ({ default: m.LoginPage })),
);
export const TwoFactorPage = lazyImport(() =>
  import("../pages/Login/TwoFactorPage").then((m) => ({
    default: m.TwoFactorPage,
  })),
);
export const RegisterPage = lazyImport(() =>
  import("../pages/Login/RegisterPage").then((m) => ({
    default: m.RegisterPage,
  })),
);
export const RegisterOrganizationPage = lazyImport(() =>
  import("../pages/Login/Tenant").then((m) => ({
    default: m.RegisterOrganizationPage,
  })),
);
export const VerifyEmailPage = lazyImport(() =>
  import("../pages/Login/VerifyEmailPage").then((m) => ({
    default: m.VerifyEmailPage,
  })),
);
export const ForgotPasswordPage = lazyImport(() =>
  import("../pages/Login/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
export const ResetPasswordPage = lazyImport(() =>
  import("../pages/Login/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);
export const AcceptInvitationPage = lazyImport(() =>
  import("../pages/Login/AcceptInvitationPage").then((m) => ({
    default: m.AcceptInvitationPage,
  })),
);
export const AgendaPage = lazyImport(() =>
  import("../pages/AgendaPage").then((m) => ({ default: m.AgendaPage })),
);
export const DemoPage = lazyImport(() =>
  import("../pages/DemoPage").then((m) => ({ default: m.DemoPage })),
);
export const OnboardingPage = lazyImport(() =>
  import("../pages/OnboardingPage").then((m) => ({
    default: m.OnboardingPage,
  })),
);
export const FoldersPage = lazyImport(() =>
  import("../pages/FoldersPage").then((m) => ({ default: m.FoldersPage })),
);
export const SongsPage = lazyImport(() =>
  import("../pages/Songs/SongsPage").then((m) => ({ default: m.SongsPage })),
);
export const SongEditorPage = lazyImport(() =>
  import("../pages/Songs/SongEditorPage").then((m) => ({
    default: m.SongEditorPage,
  })),
);
export const ServicesPage = lazyImport(() =>
  import("../pages/Services/ServicesPage").then((m) => ({
    default: m.ServicesPage,
  })),
);
export const ServiceDetailPage = lazyImport(() =>
  import("../pages/Services/ServiceDetailPage").then((m) => ({
    default: m.ServiceDetailPage,
  })),
);
export const SettingsPage = lazyImport(() =>
  import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
export const CollectionsPage = lazyImport(() =>
  import("../pages/Collections/CollectionsPage").then((m) => ({
    default: m.CollectionsPage,
  })),
);
export const CollectionDetailPage = lazyImport(() =>
  import("../pages/Collections/CollectionDetailPage").then((m) => ({
    default: m.CollectionDetailPage,
  })),
);
export const TeamsPage = lazyImport(() =>
  import("../pages/TeamsPage").then((m) => ({ default: m.TeamsPage })),
);
export const TrashPage = lazyImport(() =>
  import("../pages/TrashPage").then((m) => ({ default: m.TrashPage })),
);

export const routePreloaders: Array<{
  pattern: RegExp;
  preload: () => Promise<unknown>;
}> = [
  { pattern: /\/songs\/[^/]+/, preload: () => SongEditorPage.preload() },
  { pattern: /\/songs(\/|\?|#|$)/, preload: () => SongsPage.preload() },
  {
    pattern: /\/collections\/[^/]+/,
    preload: () => CollectionDetailPage.preload(),
  },
  {
    pattern: /\/collections(\/|\?|#|$)/,
    preload: () => CollectionsPage.preload(),
  },
  { pattern: /\/services\/[^/]+/, preload: () => ServiceDetailPage.preload() },
  { pattern: /\/services(\/|\?|#|$)/, preload: () => ServicesPage.preload() },
  { pattern: /\/folders(\/|\?|#|$)/, preload: () => FoldersPage.preload() },
  { pattern: /\/teams(\/|\?|#|$)/, preload: () => TeamsPage.preload() },
  { pattern: /\/trash(\/|\?|#|$)/, preload: () => TrashPage.preload() },
  { pattern: /\/settings(\/|\?|#|$)/, preload: () => SettingsPage.preload() },
  { pattern: /\/login(\/|\?|#|$)/, preload: () => LoginPage.preload() },
  {
    pattern: /\/two-factor(\/|\?|#|$)/,
    preload: () => TwoFactorPage.preload(),
  },
  { pattern: /\/register(\/|\?|#|$)/, preload: () => RegisterPage.preload() },
  {
    pattern: /\/new(\/|\?|#|$)/,
    preload: () => RegisterOrganizationPage.preload(),
  },
  {
    pattern: /\/verify-email(\/|\?|#|$)/,
    preload: () => VerifyEmailPage.preload(),
  },
  {
    pattern: /\/forgot-password(\/|\?|#|$)/,
    preload: () => ForgotPasswordPage.preload(),
  },
  {
    pattern: /\/reset-password(\/|\?|#|$)/,
    preload: () => ResetPasswordPage.preload(),
  },
  {
    pattern: /\/accept-invitation(\/|\?|#|$)/,
    preload: () => AcceptInvitationPage.preload(),
  },
  { pattern: /\/agenda(\/|\?|#|$)/, preload: () => DemoPage.preload() },
  { pattern: /\/demo(\/|\?|#|$)/, preload: () => DemoPage.preload() },
  {
    pattern: /\/onboarding(\/|\?|#|$)/,
    preload: () => OnboardingPage.preload(),
  },
];

export function preloadRoute(pathname: string): Promise<unknown> | null {
  for (const route of routePreloaders) {
    if (route.pattern.test(pathname)) {
      return route.preload();
    }
  }
  return null;
}
