import { SongScoreLayout } from "@/src/hooks/usePersonalSettings";
import React from "react";

export interface SongScoreVisualizerProps {
  score: number; // 0–100
  layout: SongScoreLayout;
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns Tailwind colour tokens that shift from red → amber → emerald. */
function scoreColor(score: number): {
  text: string;
  bg: string;
  ring: string;
  bar: string;
  dot: string;
  stroke: string;
} {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/15 dark:bg-emerald-400/10",
      ring: "ring-emerald-500/40 dark:ring-emerald-400/30",
      bar: "bg-emerald-500 dark:bg-emerald-400",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      stroke: "#10b981",
    };
  if (score >= 55)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/15 dark:bg-amber-400/10",
      ring: "ring-amber-500/40 dark:ring-amber-400/30",
      bar: "bg-amber-500 dark:bg-amber-400",
      dot: "bg-amber-500 dark:bg-amber-400",
      stroke: "#f59e0b",
    };
  return {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/15 dark:bg-rose-400/10",
    ring: "ring-rose-500/40 dark:ring-rose-400/30",
    bar: "bg-rose-500 dark:bg-rose-400",
    dot: "bg-rose-500 dark:bg-rose-400",
    stroke: "#f43f5e",
  };
}

// ─────────────────────────────────────────────────────────────
// Layout: ring  – SVG arc progress ring
// ─────────────────────────────────────────────────────────────
const RingLayout: React.FC<{ score: number; compact: boolean }> = ({
  score,
  compact,
}) => {
  const col = scoreColor(score);
  const size = compact ? 32 : 40;
  const strokeW = compact ? 3 : 3.5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const fontSize = compact ? 7 : 8.5;

  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col.stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      {/* Label centred on top of SVG */}
      <span
        className={`absolute font-black ${col.text} leading-none pointer-events-none`}
        style={{ fontSize }}
        aria-label={`${score}%`}
      >
        {score}
      </span>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Layout: bar  – thin horizontal progress bar + number
// ─────────────────────────────────────────────────────────────
const BarLayout: React.FC<{ score: number; compact: boolean }> = ({
  score,
  compact,
}) => {
  const col = scoreColor(score);
  const h = compact ? "h-1" : "h-1.5";

  return (
    <div
      className={`flex items-center gap-1.5 w-full ${compact ? "mt-1" : "mt-1.5"}`}
      title={`Score: ${score}`}
    >
      <div
        className={`flex-1 ${h} rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden`}
      >
        <div
          className={`${h} rounded-full ${col.bar} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={`${compact ? "text-[9px]" : "text-[10px]"} font-black tabular-nums ${col.text} shrink-0`}
      >
        {score}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Layout: dots  – row of 5 filled/hollow pips
// ─────────────────────────────────────────────────────────────
const DotsLayout: React.FC<{ score: number; compact: boolean }> = ({
  score,
  compact,
}) => {
  const col = scoreColor(score);
  const total = 5;
  const filled = Math.round((score / 100) * total);
  const dotSz = compact ? "w-1.5 h-1.5" : "w-2 h-2";
  const gap = compact ? "gap-0.5" : "gap-1";

  return (
    <div
      className={`flex items-center ${gap} ${compact ? "mt-1" : "mt-1.5"}`}
      title={`Score: ${score}`}
      aria-label={`${filled} of ${total} dots`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`${dotSz} rounded-full transition-all duration-300 ${
            i < filled
              ? `${col.dot} shadow-sm`
              : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Layout: badge  – pill chip with colour-coded score
// ─────────────────────────────────────────────────────────────
const BadgeLayout: React.FC<{ score: number; compact: boolean }> = ({
  score,
  compact,
}) => {
  const col = scoreColor(score);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-black ring-1 ${col.bg} ${col.text} ${col.ring} ${
        compact
          ? "text-[9px] px-1.5 py-0.5 mt-1"
          : "text-[10px] px-2 py-0.5 mt-1.5"
      } transition-all duration-300`}
      title={`Score: ${score}`}
      aria-label={`Score ${score}`}
    >
      {score}%
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Public component – dispatches to the correct layout
// ─────────────────────────────────────────────────────────────
export const SongScoreVisualizer: React.FC<SongScoreVisualizerProps> = ({
  score,
  layout,
  compact = false,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  if (layout === "ring") {
    return (
      <div
        className={`relative inline-flex items-center justify-center ${compact ? "w-8 h-8" : "w-10 h-10"}`}
        title={`Score: ${clamped}`}
      >
        <RingLayout score={clamped} compact={compact} />
      </div>
    );
  }

  if (layout === "bar") return <BarLayout score={clamped} compact={compact} />;
  if (layout === "dots") return <DotsLayout score={clamped} compact={compact} />;
  if (layout === "badge") return <BadgeLayout score={clamped} compact={compact} />;

  return null;
};
