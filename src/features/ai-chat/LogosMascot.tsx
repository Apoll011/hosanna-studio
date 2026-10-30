/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import "./logos.css";
import type { LogosMood } from "./types";

type Props = {
  mood?: LogosMood;
  /** Pixel size (square). */
  size?: number;
  /** Eyes follow the pointer; falls asleep after a while without input. */
  track?: boolean;
  /**
   * Poke (click), pet (hover for a while) and wake him. Gives the mascot a
   * button role when a `label` is provided.
   */
  interactive?: boolean;
  /**
   * Little unprompted behaviours while resting: glancing around, flapping,
   * stretching, humming… `"calm"` keeps to rare, subtle ones (toolbar use).
   * Defaults to on whenever `track` is on.
   */
  antics?: boolean | "calm";
  className?: string;
  label?: string;
  /** Hide the ground shadow (small avatars). */
  flat?: boolean;
};

const MAX_LOOK = 3.4;
const SLEEP_AFTER_MS = 45_000;
/** Below this the musical extras are dropped so the silhouette stays clean. */
const COMPACT_BELOW = 56;
/** Hovering this long without leaving counts as petting. */
const PET_AFTER_MS = 2_000;
/** Rapid pokes escalate: a double-click dances, 4 annoy him, 5 make him dizzy. */
const GRUMPY_POKES = 4;
const DIZZY_POKES = 5;
const POKE_WINDOW_MS = 2_200;
const DOUBLE_CLICK_MS = 380;
/** Wiggling the pointer back and forth over him tickles. */
const TICKLE_TURNS = 6;
const TICKLE_WINDOW_MS = 900;

/** Unprompted behaviours; the CSS keys off `data-act`. */
type Act =
  | "look"
  | "tilt"
  | "flap"
  | "hop"
  | "stretch"
  | "hum"
  | "ruffle"
  | "peck"
  | "sneeze"
  | "boogie"
  | "cheeky";
const ACT_MS: Record<Act, number> = {
  look: 2400,
  tilt: 2200,
  flap: 1300,
  hop: 1500,
  stretch: 2500,
  hum: 3300,
  ruffle: 1100,
  peck: 1900,
  sneeze: 1900,
  boogie: 3000,
  cheeky: 1700,
};
const ALL_ACTS = Object.keys(ACT_MS) as Act[];
const CALM_ACTS: Act[] = ["look", "tilt", "flap", "peck"];

/** What a poke can turn into (never the same twice in a row). */
const POKE_REACTIONS: { mood: LogosMood; ms: number }[] = [
  { mood: "surprised", ms: 1300 },
  { mood: "wink", ms: 1800 },
  { mood: "love", ms: 2400 },
  { mood: "excited", ms: 1800 },
  { mood: "happy", ms: 1700 },
  { mood: "singing", ms: 2600 },
  { mood: "shy", ms: 2200 },
  { mood: "cool", ms: 2800 },
];

/** Moods where nothing else is going on, so he is free to fidget. */
const isResting = (m: LogosMood) => m === "idle" || m === "helping";
/** Moods a poke may interrupt (never real work or an error). */
const isPokeable = (m: LogosMood) =>
  isResting(m) || m === "happy" || m === "sleeping";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const rand = (min: number, max: number) => min + Math.random() * (max - min);

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

function Heart({
  x,
  y,
  s = 1,
  className,
}: {
  x: number;
  y: number;
  s?: number;
  className: string;
}) {
  return (
    <g className={`logos-heart ${className}`}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path
          d="M0 5 C-10 -1 -6.5 -9.5 0 -4.6 C6.5 -9.5 10 -1 0 5 Z"
          fill="#FF5C86"
        />
        <ellipse
          cx="-3.2"
          cy="-3.4"
          rx="1.6"
          ry="1.1"
          fill="#fff"
          opacity="0.7"
          transform="rotate(-30 -3.2 -3.4)"
        />
      </g>
    </g>
  );
}

/** A 4-point sparkle centred on the origin. */
const SPARK = "M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z";

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
  interactive = false,
  antics = track,
  className = "",
  label,
  flat = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, "");
  const [asleep, setAsleep] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** A short-lived mood from poking / petting; wins over `mood`. */
  const [reaction, setReaction] = useState<LogosMood | null>(null);
  /** Current unprompted behaviour. */
  const [act, setAct] = useState<Act | null>(null);

  const asleepRef = useRef(false);
  const reactTimer = useRef(0);
  const actTimer = useRef(0);
  const petTimer = useRef(0);
  const pokes = useRef<number[]>([]);
  const lastPoke = useRef<LogosMood | null>(null);
  /** Latest "free to fidget / may be poked" flags for timers and handlers. */
  const freeRef = useRef({ fidget: false, pokeable: false });

  const playAct = useCallback((next: Act) => {
    window.clearTimeout(actTimer.current);
    setAct(next);
    actTimer.current = window.setTimeout(() => setAct(null), ACT_MS[next]);
  }, []);

  const react = useCallback((next: LogosMood, ms: number) => {
    window.clearTimeout(reactTimer.current);
    setReaction(next);
    reactTimer.current = window.setTimeout(() => setReaction(null), ms);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(reactTimer.current);
      window.clearTimeout(actTimer.current);
      window.clearTimeout(petTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!track || typeof window === "undefined") return;
    const reduced = prefersReducedMotion();
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let lx = 0;
    let ly = 0;
    let sleepTimer = 0;

    const arm = () => {
      window.clearTimeout(sleepTimer);
      sleepTimer = window.setTimeout(() => {
        asleepRef.current = true;
        setAsleep(true);
      }, SLEEP_AFTER_MS);
    };
    const apply = () => {
      raf = 0;
      el.style.setProperty("--lx", `${lx.toFixed(2)}px`);
      el.style.setProperty("--ly", `${ly.toFixed(2)}px`);
    };
    const onActivity = () => {
      if (asleepRef.current) {
        // Waking up: a big stretch and a yawn.
        asleepRef.current = false;
        setAsleep(false);
        if (!reduced) playAct("stretch");
      }
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
  }, [track, playAct]);

  const resting: LogosMood =
    track && asleep && isResting(mood) ? "sleeping" : mood;
  const shown: LogosMood = reaction ?? resting;
  const fidget = !reaction && isResting(shown);
  const pokeable = isPokeable(resting);
  const compact = size < COMPACT_BELOW;

  // Every change of mood restarts a short "settle" animation (a squash and a
  // blink) so the new pose eases in instead of snapping.
  const [seenMood, setSeenMood] = useState(shown);
  const [shift, setShift] = useState<"a" | "b" | null>(null);
  if (seenMood !== shown) {
    setSeenMood(shown);
    setShift((s) => (s === "a" ? "b" : "a"));
  }

  useEffect(() => {
    freeRef.current = { fidget, pokeable: pokeable && reaction !== "dizzy" };
  });

  // Unprompted behaviours: every so often, while he has nothing else to do.
  useEffect(() => {
    if (!antics || prefersReducedMotion()) return;
    const calm = antics === "calm";
    const pool = calm ? CALM_ACTS : ALL_ACTS;
    const gap = () => (calm ? rand(9000, 18000) : rand(4500, 9500));
    let timer = 0;
    let last: Act | null = null;

    const loop = () => {
      if (freeRef.current.fidget && !document.hidden) {
        const options = pool.filter((a) => a !== last);
        const next = options[Math.floor(Math.random() * options.length)];
        last = next;
        playAct(next);
        timer = window.setTimeout(loop, ACT_MS[next] + gap());
      } else {
        timer = window.setTimeout(loop, gap());
      }
    };
    timer = window.setTimeout(loop, gap());
    return () => window.clearTimeout(timer);
  }, [antics, playAct]);

  const poke = useCallback(() => {
    if (!interactive || !freeRef.current.pokeable) return;
    window.clearTimeout(petTimer.current);
    const now = performance.now();
    const prev = pokes.current[pokes.current.length - 1];
    pokes.current = [
      ...pokes.current.filter((at) => now - at < POKE_WINDOW_MS),
      now,
    ];
    const count = pokes.current.length;
    const go = (mood: LogosMood, ms: number) => {
      lastPoke.current = mood;
      react(mood, ms);
    };
    if (count >= DIZZY_POKES) {
      pokes.current = [];
      go("dizzy", 3200);
    } else if (count === GRUMPY_POKES) {
      go("grumpy", 1800);
    } else if (prev !== undefined && now - prev < DOUBLE_CLICK_MS) {
      go("dance", 3200);
    } else {
      const options = POKE_REACTIONS.filter((r) => r.mood !== lastPoke.current);
      const pick = options[Math.floor(Math.random() * options.length)];
      go(pick.mood, pick.ms);
    }
  }, [interactive, react]);

  // Wiggling the pointer back and forth over him tickles.
  const tickle = useRef({ x: 0, dir: 0, turns: [] as number[] });
  const onPointerMove = (e: React.PointerEvent) => {
    if (!freeRef.current.pokeable || e.pointerType === "touch") return;
    const t = tickle.current;
    const dx = e.clientX - t.x;
    if (Math.abs(dx) < 4) return;
    const dir = Math.sign(dx);
    t.x = e.clientX;
    if (t.dir !== 0 && dir !== t.dir) {
      const now = performance.now();
      t.turns = [...t.turns.filter((at) => now - at < TICKLE_WINDOW_MS), now];
      if (t.turns.length >= TICKLE_TURNS) {
        t.turns = [];
        window.clearTimeout(petTimer.current);
        lastPoke.current = "giggle";
        react("giggle", 1900);
      }
    }
    t.dir = dir;
  };

  const onPointerEnter = () => {
    setHovered(true);
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => {
      if (freeRef.current.pokeable) {
        lastPoke.current = "love";
        react("love", 2600);
      }
    }, PET_AFTER_MS);
  };
  const onPointerLeave = () => {
    setHovered(false);
    window.clearTimeout(petTimer.current);
  };

  const asButton = interactive && Boolean(label);

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
      {/* tiny equalizer — dances while he listens, works or sings */}
      <g className="logos-eq">
        {[17.4, 20, 22.6].map((x, i) => (
          <rect
            key={x}
            className={`logos-eq-bar logos-eq-${i}`}
            x={x - 0.8}
            y="73"
            width="1.6"
            height="11"
            rx="0.8"
            fill="#B5611B"
            opacity="0.6"
          />
        ))}
      </g>
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
      className={`logos ${compact ? "logos-compact" : ""} ${
        interactive ? "logos-interactive" : ""
      } ${className}`}
      data-mood={shown}
      data-act={fidget && act ? act : undefined}
      data-hover={interactive && hovered ? "true" : undefined}
      data-shift={shift ?? undefined}
      style={{ width: size, height: size }}
      role={asButton ? "button" : label ? "img" : undefined}
      tabIndex={asButton ? 0 : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerEnter={interactive ? onPointerEnter : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onClick={interactive ? poke : undefined}
      onKeyDown={
        asButton
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                poke();
              }
            }
          : undefined
      }
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
          <radialGradient id={u("aura")} cx="50%" cy="50%" r="50%">
            <stop offset="0.35" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={u("lens")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#26365E" />
            <stop offset="1" stopColor="#070B18" />
          </linearGradient>
          <radialGradient id={u("glow")} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={SKY} stopOpacity="0.26" />
            <stop offset="1" stopColor={SKY} stopOpacity="0" />
          </radialGradient>
          <clipPath id={u("clip")}>
            <path d="M80 24 C112 24 134 46 134 78 C134 108 114 128 80 128 C46 128 26 108 26 78 C26 46 48 24 80 24 Z" />
          </clipPath>
        </defs>

        <circle
          className="logos-aura"
          cx="80"
          cy="80"
          r="84"
          fill={ref("aura")}
        />
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
        <g
          className="logos-anger"
          fill="none"
          stroke="#E5484D"
          strokeWidth="2.6"
          strokeLinecap="round"
        >
          <path
            transform="translate(15 -10)"
            d="M126 24 q4 0 4 -5 M138 24 q-4 0 -4 -5 M126 36 q4 0 4 5 M138 36 q-4 0 -4 5"
          />
        </g>
        <g className="logos-hearts">
          <Heart x={26} y={44} s={1.1} className="logos-heart-a" />
          <Heart x={136} y={38} s={0.95} className="logos-heart-b" />
          <Heart x={146} y={92} s={0.8} className="logos-heart-c" />
        </g>
        <path
          className="logos-sparkle"
          d="M147 56 l2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 7 -2.4 z"
          fill={GOLD}
        />
        <g className="logos-bang" fill={ORANGE}>
          <rect x="136" y="8" width="6.4" height="19" rx="3.2" />
          <circle cx="139.2" cy="34" r="3.6" />
        </g>
        <path
          className="logos-drop"
          d="M121 46 q5.5 8 0 12 q-5.5 -4 0 -12 z"
          fill="#8EDCF8"
          stroke="#4FB7E6"
          strokeWidth="1"
        />

        <g className="logos-morph">
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
                {/* soft chest feathers */}
                <g
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.34"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="M66 107 q7 5.4 14 0 q7 5.4 14 0" />
                  <path d="M73 116.5 q7 5 14 0" />
                </g>
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
                {/* rosy cheeks */}
                <g fill="#FF8CA8">
                  <ellipse
                    className="logos-blush"
                    cx="46"
                    cy="92"
                    rx="7.4"
                    ry="4.4"
                  />
                  <ellipse
                    className="logos-blush"
                    cx="114"
                    cy="92"
                    rx="7.4"
                    ry="4.4"
                  />
                </g>
                {/* eyebrows — only visible when the mood needs them */}
                <g
                  className="logos-brows"
                  fill="none"
                  stroke="#123A63"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                >
                  <path
                    className="logos-brow logos-brow-l"
                    d="M53.5 60 Q62 55.5 70.5 60"
                  />
                  <path
                    className="logos-brow logos-brow-r"
                    d="M89.5 60 Q98 55.5 106.5 60"
                  />
                </g>
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
                {/* wink: the right eye closes into a happy arc */}
                <path
                  className="logos-eye-wink"
                  d="M88.5 78 Q98 63 107.5 78"
                  fill="none"
                  stroke={INK}
                  strokeWidth="4.6"
                  strokeLinecap="round"
                />
                {/* heart eyes */}
                <g className="logos-eyes-love">
                  {[62, 98].map((cx) => (
                    <g key={cx} className="logos-heart-eye">
                      <path
                        d={`M${cx} 83 C${cx - 12} 74 ${cx - 7} 63 ${cx} 69.5 C${cx + 7} 63 ${cx + 12} 74 ${cx} 83 Z`}
                        fill="#FF4D7A"
                      />
                      <ellipse
                        cx={cx - 3.6}
                        cy="69.8"
                        rx="2.2"
                        ry="1.5"
                        fill="#fff"
                        opacity="0.75"
                        transform={`rotate(-30 ${cx - 3.6} 69.8)`}
                      />
                    </g>
                  ))}
                </g>
                {/* dizzy spiral eyes */}
                <g
                  className="logos-eyes-dizzy"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                >
                  {[62, 98].map((cx) => (
                    <path
                      key={cx}
                      className="logos-spiral"
                      d={`M${cx} 75 a1.5 1.5 0 0 1 3 0 a3 3 0 0 1 -6 0 a4.5 4.5 0 0 1 9 0 a6 6 0 0 1 -12 0 a7.5 7.5 0 0 1 15 0`}
                    />
                  ))}
                </g>
                {/* cool: shades slide down over the eyes */}
                <g className="logos-shades">
                  <rect
                    x="48"
                    y="63"
                    width="28"
                    height="20"
                    rx="8.5"
                    fill={ref("lens")}
                  />
                  <rect
                    x="84"
                    y="63"
                    width="28"
                    height="20"
                    rx="8.5"
                    fill={ref("lens")}
                  />
                  <path
                    d="M75 69 Q80 65.5 85 69"
                    fill="none"
                    stroke="#0B1226"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M53.5 69.5 l8 -2.6 M89.5 69.5 l8 -2.6"
                    stroke="#fff"
                    strokeOpacity="0.5"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
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
                {/* sneeze puff */}
                <g className="logos-puff" fill="#fff">
                  <circle cx="97" cy="97" r="2.8" />
                  <circle cx="104" cy="92" r="2" />
                  <circle cx="103" cy="101" r="1.7" />
                </g>
              </g>

              {/* wings (front layer so they can reach the beak) */}
              <g className="logos-wing logos-wing-l">{wing(false)}</g>
              <g className="logos-wing logos-wing-r">{wing(true)}</g>
            </g>
          </g>
        </g>

        {/* dizzy stars circling the head (front layer) */}
        <g className="logos-dizzy-stars">
          {[0, 1, 2].map((i) => (
            <g
              key={i}
              className="logos-star-x"
              style={{ animationDelay: `${-i * 0.8}s` }}
            >
              <g
                className="logos-star-y"
                style={{ animationDelay: `${-0.6 - i * 0.8}s` }}
              >
                <path
                  d={SPARK}
                  transform="translate(80 22)"
                  fill={i === 1 ? CYAN : GOLD}
                />
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};
