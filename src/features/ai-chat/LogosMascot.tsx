/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef } from "react";
import type { LogosMood } from "./types";

type Props = {
  mood?: LogosMood;
  /** Pixel size (square). */
  size?: number;
  /** Eyes follow the pointer (large empty-state mascot). */
  track?: boolean;
  className?: string;
  label?: string;
  /** Hide the ground shadow (small avatars). */
  flat?: boolean;
};

const MAX_LOOK = 3.2;

/**
 * Logos — the animated assistant. Pure SVG + CSS (see `.logos-*` in
 * index.css), themed with `--m3-*` tokens, honours prefers-reduced-motion.
 */
export const LogosMascot: React.FC<Props> = ({
  mood = "idle",
  size = 120,
  track = false,
  className = "",
  label,
  flat = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    if (!track || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let lx = 0;
    let ly = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--lx", `${lx.toFixed(2)}px`);
      el.style.setProperty("--ly", `${ly.toFixed(2)}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 160) * MAX_LOOK;
      lx = (dx / dist) * k;
      ly = (dy / dist) * k;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [track]);

  return (
    <div
      ref={rootRef}
      className={`logos ${className}`}
      data-mood={mood}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" focusable="false">
        <defs>
          <radialGradient id={`${gid}-body`} cx="38%" cy="30%" r="80%">
            <stop
              offset="0%"
              style={{ stopColor: "var(--m3-primary-light)" }}
            />
            <stop offset="100%" style={{ stopColor: "var(--m3-primary)" }} />
          </radialGradient>
          <radialGradient id={`${gid}-glow`} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              style={{ stopColor: "var(--m3-primary)", stopOpacity: 0.28 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "var(--m3-primary)", stopOpacity: 0 }}
            />
          </radialGradient>
        </defs>

        <circle
          className="logos-glow"
          cx="60"
          cy="62"
          r="58"
          fill={`url(#${gid}-glow)`}
        />
        {!flat && (
          <ellipse
            className="logos-shadow"
            cx="60"
            cy="110"
            rx="26"
            ry="4.5"
            style={{ fill: "var(--m3-text)" }}
          />
        )}

        <g className="logos-orbit">
          <circle cx="60" cy="8" r="2.6" fill="#f5b942" />
          <circle
            cx="104"
            cy="70"
            r="2"
            style={{ fill: "var(--m3-primary-light)" }}
          />
          <circle cx="20" cy="82" r="2.2" fill="#f5b942" />
        </g>

        <g className="logos-float">
          <g className="logos-body">
            {/* halo */}
            <ellipse
              className="logos-halo"
              cx="60"
              cy="17"
              rx="17"
              ry="5.2"
              fill="none"
              stroke="#f5b942"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* body */}
            <circle cx="60" cy="63" r="38" fill={`url(#${gid}-body)`} />
            <ellipse
              cx="46"
              cy="42"
              rx="11"
              ry="6"
              fill="#fff"
              opacity="0.22"
              transform="rotate(-24 46 42)"
            />
            {/* cheeks */}
            <ellipse
              cx="38"
              cy="72"
              rx="5.5"
              ry="3.4"
              fill="#ff8fa3"
              opacity="0.5"
            />
            <ellipse
              cx="82"
              cy="72"
              rx="5.5"
              ry="3.4"
              fill="#ff8fa3"
              opacity="0.5"
            />

            {/* eyes */}
            <g className="logos-eyes">
              <g className="logos-eye">
                <ellipse cx="46" cy="60" rx="8" ry="9" fill="#fff" />
                <circle
                  className="logos-pupil"
                  cx="46"
                  cy="61"
                  r="4.6"
                  fill="#1b2340"
                />
                <circle
                  className="logos-spark"
                  cx="44"
                  cy="58.6"
                  r="1.5"
                  fill="#fff"
                />
              </g>
              <g className="logos-eye">
                <ellipse cx="74" cy="60" rx="8" ry="9" fill="#fff" />
                <circle
                  className="logos-pupil"
                  cx="74"
                  cy="61"
                  r="4.6"
                  fill="#1b2340"
                />
                <circle
                  className="logos-spark"
                  cx="72"
                  cy="58.6"
                  r="1.5"
                  fill="#fff"
                />
              </g>
            </g>
            {/* happy ^ ^ eyes */}
            <g
              className="logos-eyes-happy"
              fill="none"
              stroke="#1b2340"
              strokeWidth="3.4"
              strokeLinecap="round"
            >
              <path d="M38 62 Q46 52 54 62" />
              <path d="M66 62 Q74 52 82 62" />
            </g>
            {/* oops x x eyes */}
            <g
              className="logos-eyes-oops"
              fill="none"
              stroke="#1b2340"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M41 56 L51 66 M51 56 L41 66" />
              <path d="M69 56 L79 66 M79 56 L69 66" />
            </g>

            {/* mouths */}
            <path
              className="logos-mouth logos-mouth-idle"
              d="M52 78 Q60 85 68 78"
              fill="none"
              stroke="#1b2340"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              className="logos-mouth logos-mouth-happy"
              d="M49 76 Q60 92 71 76 Z"
              fill="#1b2340"
              stroke="#1b2340"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <ellipse
              className="logos-mouth logos-mouth-think"
              cx="60"
              cy="80"
              rx="3.6"
              ry="4.2"
              fill="#1b2340"
            />
            <path
              className="logos-mouth logos-mouth-oops"
              d="M50 83 Q55 77 60 83 T70 83"
              fill="none"
              stroke="#1b2340"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* floating notes (happy / idle) */}
        <g className="logos-notes" style={{ fill: "var(--m3-primary)" }}>
          <path
            className="logos-note logos-note-a"
            d="M96 40 v-14 l9 -2 v12 a3.2 3.2 0 1 1 -2 -3 v-6 l-5 1 v10 a3.2 3.2 0 1 1 -2 -3 z"
          />
          <path
            className="logos-note logos-note-b"
            d="M16 46 v-12 l8 -2 v10 a2.8 2.8 0 1 1 -2 -2.6 v-5 l-4 1 v9 a2.8 2.8 0 1 1 -2 -2.6 z"
          />
        </g>
        {/* sweat drop (oops) */}
        <path
          className="logos-drop"
          d="M94 48 q4 6 0 9 q-4 -3 0 -9 z"
          fill="#7dd3fc"
        />
      </svg>
    </div>
  );
};
