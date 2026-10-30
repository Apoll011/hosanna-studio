/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef, useState } from "react";
import "./logos.css";
import type { LogosMood } from "./types";

type Props = {
  mood?: LogosMood;
  /** Pixel size (square). */
  size?: number;
  /** Eyes follow the pointer; falls asleep after a while without input. */
  track?: boolean;
  className?: string;
  label?: string;
  /** Hide the ground shadow (small avatars). */
  flat?: boolean;
};

const MAX_LOOK = 3.4;
const SLEEP_AFTER_MS = 45_000;
/** Below this the musical extras are dropped so the silhouette stays clean. */
const COMPACT_BELOW = 56;

/* Brand palette (fixed — the mascot looks the same in every theme). */
const SKY = "#36A9E8";
const OCEAN = "#168BCB";
const CYAN = "#8DDAF5";
const GOLD = "#FFBE45";
const ORANGE = "#F39A32";
const INK = "#0E1630";

function Note({
  x,
  y,
  color,
  className,
}: {
  x: number;
  y: number;
  color: string;
  className: string;
}) {
  return (
    <g className={`logos-note ${className}`}>
      <g transform={`translate(${x} ${y})`}>
        <ellipse
          cx="0"
          cy="0"
          rx="4.6"
          ry="3.4"
          transform="rotate(-22)"
          fill={color}
        />
        <path
          d="M3.9 -1.6 V-16 q0 3.4 6.4 5.4"
          fill="none"
          stroke={color}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/**
 * Logos — the Hosanna AI mascot: a plump sky-blue songbird in golden
 * over-ear headphones. Pure SVG + CSS (see `logos.css`), so it scales from a
 * 26px chat avatar to a hero illustration. The musical extras (notes, sound
 * waves, sparkles) are separate, mood-driven layers — the bird itself is
 * always recognisable on its own.
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
  const [asleep, setAsleep] = useState(false);

  useEffect(() => {
    if (!track || typeof window === "undefined") return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let lx = 0;
    let ly = 0;
    let sleepTimer = 0;

    const arm = () => {
      window.clearTimeout(sleepTimer);
      sleepTimer = window.setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    };
    const apply = () => {
      raf = 0;
      el.style.setProperty("--lx", `${lx.toFixed(2)}px`);
      el.style.setProperty("--ly", `${ly.toFixed(2)}px`);
    };
    const onActivity = () => {
      setAsleep(false);
      arm();
    };
    const onMove = (e: PointerEvent) => {
      onActivity();
      if (reduced) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 160) * MAX_LOOK;
      lx = (dx / dist) * k;
      ly = (dy / dist) * k;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    arm();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.clearTimeout(sleepTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [track]);

  const shown: LogosMood =
    track && asleep && (mood === "idle" || mood === "helping")
      ? "sleeping"
      : mood;
  const compact = size < COMPACT_BELOW;

  const u = (name: string) => `${gid}-${name}`;
  const ref = (name: string) => `url(#${u(name)})`;

  /** One ear cup, drawn for the left side; the right is mirrored. */
  const cup = (mirror: boolean) => (
    <g transform={mirror ? "translate(160 0) scale(-1 1)" : undefined}>
      {/* soft contact shadow on the feathers */}
      <ellipse cx="30" cy="80" rx="15" ry="26" fill={ref("occ")} />
      {/* dark cushion peeking out on the head side */}
      <ellipse cx="28.5" cy="78" rx="7" ry="17.5" fill={ref("pad")} />
      {/* golden shell */}
      <ellipse cx="21.5" cy="78" rx="11.5" ry="19.5" fill={ref("gold")} />
      <ellipse
        cx="20.5"
        cy="78"
        rx="6.8"
        ry="13"
        fill="none"
        stroke="#E8862A"
        strokeOpacity="0.55"
        strokeWidth="1.6"
      />
      <ellipse cx="20" cy="78" rx="4" ry="8" fill="#FFD27A" opacity="0.5" />
      <ellipse
        cx="17.5"
        cy="66"
        rx="3.4"
        ry="6.4"
        fill="#fff"
        opacity="0.5"
        transform="rotate(8 17.5 66)"
      />
    </g>
  );

  /** One wing, drawn for the left side; the right is mirrored. */
  const wing = (mirror: boolean) => (
    <g transform={mirror ? "translate(160 0) scale(-1 1)" : undefined}>
      <path
        d="M36 96 C22 96 11 108 14 122 C16.5 131 27 130 33 122 C41 112 43.5 103 36 96 Z"
        fill={ref("wing")}
      />
      <path
        d="M33 106 C27 110 22 117 21 124 M38 108 C33 113 29 119 28 125"
        fill="none"
        stroke={OCEAN}
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M30 99.5 C22 101 16.5 108 16 116"
        fill="none"
        stroke={CYAN}
        strokeOpacity="0.7"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );

  return (
    <div
      ref={rootRef}
      className={`logos ${compact ? "logos-compact" : ""} ${className}`}
      data-mood={shown}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 160 160" width="100%" height="100%" focusable="false">
        <defs>
          <radialGradient id={u("body")} cx="36%" cy="26%" r="82%">
            <stop offset="0" stopColor={CYAN} />
            <stop offset="0.34" stopColor="#4CB9F0" />
            <stop offset="0.68" stopColor={SKY} />
            <stop offset="1" stopColor={OCEAN} />
          </radialGradient>
          <linearGradient id={u("ao")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#0A5C93" stopOpacity="0" />
            <stop offset="1" stopColor="#0A5C93" stopOpacity="0.42" />
          </linearGradient>
          <radialGradient id={u("belly")} cx="50%" cy="38%" r="62%">
            <stop offset="0" stopColor="#D5F3FD" stopOpacity="0.95" />
            <stop offset="0.6" stopColor={CYAN} stopOpacity="0.55" />
            <stop offset="1" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={u("wing")} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#2FA2E4" />
            <stop offset="1" stopColor="#1279B5" />
          </linearGradient>
          <linearGradient id={u("tail")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={SKY} />
            <stop offset="1" stopColor="#1279B5" />
          </linearGradient>
          <radialGradient id={u("gold")} cx="34%" cy="26%" r="85%">
            <stop offset="0" stopColor="#FFE29A" />
            <stop offset="0.45" stopColor={GOLD} />
            <stop offset="1" stopColor="#E9892B" />
          </radialGradient>
          <radialGradient id={u("pad")} cx="35%" cy="50%" r="75%">
            <stop offset="0" stopColor="#2A3F66" />
            <stop offset="1" stopColor="#101C33" />
          </radialGradient>
          <radialGradient id={u("occ")} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#0A5C93" stopOpacity="0.38" />
            <stop offset="1" stopColor="#0A5C93" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={u("band")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2F4A78" />
            <stop offset="1" stopColor="#14223D" />
          </linearGradient>
          <radialGradient id={u("beak")} cx="38%" cy="25%" r="85%">
            <stop offset="0" stopColor="#FFD08A" />
            <stop offset="0.5" stopColor="#FAAE45" />
            <stop offset="1" stopColor={ORANGE} />
          </radialGradient>
          <linearGradient id={u("leg")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFB04E" />
            <stop offset="1" stopColor="#E98A27" />
          </linearGradient>
          <radialGradient id={u("eye")} cx="40%" cy="30%" r="80%">
            <stop offset="0" stopColor="#25325A" />
            <stop offset="1" stopColor={INK} />
          </radialGradient>
          <radialGradient id={u("glow")} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={SKY} stopOpacity="0.26" />
            <stop offset="1" stopColor={SKY} stopOpacity="0" />
          </radialGradient>
          <clipPath id={u("clip")}>
            <path d="M80 24 C112 24 134 46 134 78 C134 108 114 128 80 128 C46 128 26 108 26 78 C26 46 48 24 80 24 Z" />
          </clipPath>
        </defs>

        <circle
          className="logos-glow"
          cx="80"
          cy="80"
          r="76"
          fill={ref("glow")}
        />
        {!flat && (
          <ellipse
            className="logos-shadow"
            cx="80"
            cy="148"
            rx="34"
            ry="5.5"
            fill="#0A2540"
          />
        )}

        {/* musical extras — separate layers, driven by mood */}
        <g className="logos-orbit">
          <circle cx="80" cy="6" r="2.8" fill={GOLD} />
          <circle cx="150" cy="86" r="2.2" fill={CYAN} />
          <circle cx="14" cy="100" r="2.4" fill={GOLD} />
          <circle cx="116" cy="146" r="1.9" fill={CYAN} />
        </g>
        <g className="logos-notes">
          <Note x={20} y={46} color={GOLD} className="logos-note-a" />
          <Note x={140} y={42} color={CYAN} className="logos-note-b" />
          <Note x={148} y={96} color={SKY} className="logos-note-c" />
        </g>
        <g className="logos-waves" fill="none" strokeLinecap="round">
          <g stroke={GOLD}>
            <path
              className="logos-wave-1"
              d="M7 66 Q1.5 78 7 90"
              strokeWidth="2.6"
            />
            <path
              className="logos-wave-2"
              d="M1 59 Q-8 78 1 97"
              strokeWidth="2.2"
            />
          </g>
          <g stroke={GOLD}>
            <path
              className="logos-wave-1"
              d="M153 66 Q158.5 78 153 90"
              strokeWidth="2.6"
            />
            <path
              className="logos-wave-2"
              d="M159 59 Q168 78 159 97"
              strokeWidth="2.2"
            />
          </g>
        </g>
        <g
          className="logos-zzz"
          fill="none"
          stroke={CYAN}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className="logos-z-a"
            d="M118 40 h11 l-11 13 h11"
            strokeWidth="3"
          />
          <path
            className="logos-z-b"
            d="M134 24 h8 l-8 9.5 h8"
            strokeWidth="2.4"
          />
        </g>
        <path
          className="logos-sparkle"
          d="M147 56 l2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 7 -2.4 z"
          fill={GOLD}
        />
        <path
          className="logos-drop"
          d="M121 46 q5.5 8 0 12 q-5.5 -4 0 -12 z"
          fill="#8EDCF8"
          stroke="#4FB7E6"
          strokeWidth="1"
        />

        <g className="logos-float">
          <g className="logos-body">
            {/* tail feathers, peeking out behind the body */}
            <g className="logos-tail">
              <ellipse
                cx="114"
                cy="135"
                rx="6"
                ry="15"
                transform="rotate(-28 114 119)"
                fill={ref("tail")}
              />
              <ellipse
                cx="114"
                cy="135"
                rx="6"
                ry="15"
                transform="rotate(-52 114 119)"
                fill="#1B8FD0"
              />
              <ellipse
                cx="114"
                cy="135"
                rx="6"
                ry="15"
                transform="rotate(-76 114 119)"
                fill={ref("tail")}
              />
            </g>

            {/* legs and feet */}
            <g>
              {[66, 94].map((x) => (
                <g key={x}>
                  <rect
                    x={x - 3}
                    y="122"
                    width="6"
                    height="16"
                    rx="3"
                    fill={ref("leg")}
                  />
                  <ellipse
                    cx={x}
                    cy="140.5"
                    rx="11.5"
                    ry="5.4"
                    fill={ref("leg")}
                  />
                  <path
                    d={`M${x - 5} 142.5 v-4 M${x} 143.5 v-4.5 M${x + 5} 142.5 v-4`}
                    stroke="#D77A1D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <ellipse
                    cx={x - 3}
                    cy="138.6"
                    rx="5"
                    ry="1.6"
                    fill="#fff"
                    opacity="0.35"
                  />
                </g>
              ))}
            </g>

            {/* body + head as one plump silhouette */}
            <path
              d="M80 24 C112 24 134 46 134 78 C134 108 114 128 80 128 C46 128 26 108 26 78 C26 46 48 24 80 24 Z"
              fill={ref("body")}
            />
            <g clipPath={`url(#${u("clip")})`}>
              <ellipse cx="80" cy="106" rx="38" ry="26" fill={ref("belly")} />
              <rect x="20" y="24" width="120" height="110" fill={ref("ao")} />
            </g>
            {/* glossy highlights */}
            <ellipse
              cx="55"
              cy="40"
              rx="19"
              ry="8.5"
              fill="#fff"
              opacity="0.36"
              transform="rotate(-24 55 40)"
            />
            <circle cx="40" cy="50" r="2.6" fill="#fff" opacity="0.55" />

            {/* little crest */}
            <g className="logos-crest">
              <path
                d="M80 22 C74 12 70 8 66 9 C70 14 72 19 74 23 Z"
                fill={SKY}
              />
              <path
                d="M80 22 C80 11 82 5 87 4 C85 10 85 17 84 23 Z"
                fill="#2B9DE0"
              />
              <path
                d="M82 23 C88 14 93 12 97 14 C93 17 90 20 87 24 Z"
                fill={SKY}
              />
            </g>

            {/* headphones: band */}
            <path
              d="M25 72 C19 4 141 4 135 72"
              fill="none"
              stroke="#0B1730"
              strokeOpacity="0.35"
              strokeWidth="9"
              strokeLinecap="round"
              transform="translate(0 1.6)"
            />
            <path
              d="M25 72 C19 4 141 4 135 72"
              fill="none"
              stroke={ref("band")}
              strokeWidth="7.5"
              strokeLinecap="round"
            />
            <path
              d="M29 66 C26 14 134 14 131 66"
              fill="none"
              stroke="#5B79AB"
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform="translate(0 -1)"
            />
            {cup(false)}
            {cup(true)}

            {/* face */}
            <g className="logos-face">
              <g className="logos-eyes">
                <g className="logos-look">
                  {[62, 98].map((cx, i) => (
                    <g key={cx} className="logos-eye">
                      <ellipse
                        cx={cx}
                        cy="75"
                        rx="8.6"
                        ry="11"
                        fill={ref("eye")}
                        transform={`rotate(${i === 0 ? 7 : -7} ${cx} 75)`}
                      />
                      <circle cx={cx - 2.8} cy="70.4" r="3.1" fill="#fff" />
                      <circle
                        cx={cx + 2.8}
                        cy="80.2"
                        r="1.5"
                        fill="#fff"
                        opacity="0.85"
                      />
                    </g>
                  ))}
                </g>
              </g>
              <g
                className="logos-eyes-happy"
                fill="none"
                stroke={INK}
                strokeWidth="4.6"
                strokeLinecap="round"
              >
                <path d="M52.5 78 Q62 63 71.5 78" />
                <path d="M88.5 78 Q98 63 107.5 78" />
              </g>
              <g
                className="logos-eyes-sleep"
                fill="none"
                stroke={INK}
                strokeWidth="4.2"
                strokeLinecap="round"
              >
                <path d="M53 73 Q62 82 71 73" />
                <path d="M89 73 Q98 82 107 73" />
              </g>

              {/* beak */}
              <g className="logos-beak">
                <ellipse
                  className="logos-mouth"
                  cx="80"
                  cy="92"
                  rx="7.6"
                  ry="5.2"
                  fill="#6B2410"
                />
                <ellipse
                  className="logos-tongue"
                  cx="80"
                  cy="95.4"
                  rx="4.2"
                  ry="2.2"
                  fill="#F26B6B"
                />
                <g className="logos-beak-low">
                  <path
                    d="M71.5 91 Q71.5 99.5 80 99.5 Q88.5 99.5 88.5 91 Z"
                    fill="#DB7418"
                  />
                </g>
                <path
                  d="M69.5 88.5 Q69.5 79.5 80 79.5 Q90.5 79.5 90.5 88.5 Q90.5 93.6 80 93.6 Q69.5 93.6 69.5 88.5 Z"
                  fill={ref("beak")}
                />
                <ellipse
                  cx="76"
                  cy="83.4"
                  rx="4.2"
                  ry="2.2"
                  fill="#fff"
                  opacity="0.5"
                  transform="rotate(-14 76 83.4)"
                />
              </g>
            </g>

            {/* wings (front layer so they can reach the beak) */}
            <g className="logos-wing logos-wing-l">{wing(false)}</g>
            <g className="logos-wing logos-wing-r">{wing(true)}</g>
          </g>
        </g>
      </svg>
    </div>
  );
};
