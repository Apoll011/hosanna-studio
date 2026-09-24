/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTheme } from "../../../contexts/ThemeContext";

const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export interface TurnstileHandle {
  reset: () => void;
  show: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  TurnstileWidgetProps
>(({ onVerify, onExpire, onError }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const { darkMode } = useTheme();
  // Initially false so the widget takes 0 height and is invisible.
  // When Cloudflare requires user interaction, 'before-interactive-callback' triggers
  // and we reveal the widget.
  const [requiresInteraction, setRequiresInteraction] = useState(false);

  const renderWidget = () => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: darkMode ? "dark" : "light",
      size: "flexible",
      callback: (token: string) => {
        setRequiresInteraction(false);
        onVerify(token);
      },
      "before-interactive-callback": () => {
        // Turnstile requires interactive challenge / user input
        setRequiresInteraction(true);
      },
      "after-interactive-callback": () => {
        // Interactive challenge finished
        setRequiresInteraction(false);
      },
      "expired-callback": () => {
        onExpire?.();
      },
      "error-callback": () => {
        onError?.();
      },
    });
  };

  useEffect(() => {
    // If Turnstile is already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Otherwise inject script
    window.onTurnstileLoad = renderWidget;
    if (!document.querySelector("#cf-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [darkMode]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setRequiresInteraction(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
    // Reveal the widget so the user can see the verification in progress
    show: () => setRequiresInteraction(true),
  }));

  return (
    <div
      className={`transition-all duration-300 flex justify-center w-full overflow-hidden ${
        requiresInteraction
          ? "my-3 max-h-24 opacity-100"
          : "max-h-0 opacity-0 pointer-events-none my-0"
      }`}
      aria-hidden={!requiresInteraction}
    >
      <div ref={containerRef} className="w-full flex justify-center" />
    </div>
  );
});

TurnstileWidget.displayName = "TurnstileWidget";
