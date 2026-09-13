import { configureApiClient } from "@/src/api";
import { preloadEditor } from "@hosanna/chordpro/editor";
import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { NavigationProgressBar } from "./components/NavigationProgressBar";
import { AuthProvider } from "./contexts/AuthContext";
import { CacheHydrationProvider } from "./contexts/CacheHydrationProvider";
import { NavigationTransitionProvider } from "./contexts/NavigationTransitionContext";
import { PrintProvider } from "./contexts/PrintContext";
import { SyncProvider } from "./contexts/SyncContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import { posthog } from "./lib/posthog";
import { AppRoutes } from "./routes/AppRoutes";

// Configure the API client once at module load time (not on every render).
// Reading localStorage here is safe — it happens synchronously during the
// module evaluation, before any React rendering.
configureApiClient(
  localStorage.getItem("server_url") || import.meta.env.VITE_API_URL || "/api",
);

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  // Preload the heavy ChordPro editor bundle after the UI has had 3 s to
  // settle. The timer is cleared if the component unmounts (e.g. HMR).
  useEffect(() => {
    const id = setTimeout(() => {
      void preloadEditor();
    }, 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <AuthProvider>
      <I18nProvider>
        <ThemeProvider>
          <SyncProvider>
            <CacheHydrationProvider>
              <PrintProvider>
                <BrowserRouter>
                  <NavigationTransitionProvider>
                    <PageviewTracker />
                    <NavigationProgressBar />
                    <AppRoutes />
                  </NavigationTransitionProvider>
                </BrowserRouter>
              </PrintProvider>
            </CacheHydrationProvider>
          </SyncProvider>
        </ThemeProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
