import { motion, useTransform, type MotionValue } from "framer-motion";
import type { CSSProperties } from "react";

/**
 * Layered city scene for the landing hero: a far downtown skyline (with the
 * CN Tower), a mid band of mid-rise buildings, and a street of multiplexes in
 * front. Each layer is driven by the same scroll progress at a different
 * rate, so the street moves faster than the towers as the page scrolls.
 *
 * All geometry is deterministic (no Math.random) so SSR and hydration agree
 * and window lights don't reshuffle on re-render.
 */

const W = 1600;
const H = 420;
const GROUND = H;

// [x, width, height]
const FAR: ReadonlyArray<readonly [number, number, number]> = [
  [0, 70, 200], [80, 50, 270], [140, 90, 160], [240, 60, 340], [310, 110, 230],
  [430, 40, 300], [480, 60, 190], [610, 70, 380], [690, 50, 250], [750, 140, 150],
  [900, 60, 330], [970, 90, 240], [1070, 40, 400], [1120, 120, 200], [1250, 70, 280],
  [1330, 100, 170], [1440, 60, 320], [1510, 90, 210],
];

const MID: ReadonlyArray<readonly [number, number, number]> = [
  [-20, 120, 120], [120, 90, 160], [230, 150, 100], [400, 110, 140], [530, 80, 180],
  [630, 160, 110], [810, 120, 150], [950, 90, 130], [1060, 170, 100], [1250, 110, 160],
  [1380, 140, 120], [1540, 120, 140],
];

/** Cheap deterministic hash → [0, 1). Used to decide which windows are lit. */
function hash(a: number, b: number, c = 0) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function MidWindows({ x, w, h, index }: { x: number; w: number; h: number; index: number }) {
  const cols = Math.max(2, Math.floor((w - 16) / 18));
  const rows = Math.max(2, Math.floor((h - 16) / 22));
  const cells: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = hash(index, r, c) > 0.72;
      if (!lit) continue;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + 10 + c * 18}
          y={GROUND - h + 10 + r * 22}
          width={7}
          height={9}
          rx={0.5}
          className="rl-window"
          style={{ "--flicker-delay": `${hash(c, r, index) * 6}s` } as CSSProperties}
          fill="hsl(38 90% 74% / 0.35)"
        />,
      );
    }
  }
  return <>{cells}</>;
}

/** Stacked fourplex: flat roof with parapet, central door, 2 x 3 windows. */
function Fourplex({ x, seed }: { x: number; seed: number }) {
  const w = 120;
  const h = 140;
  const top = GROUND - h;
  const windows: JSX.Element[] = [];
  const rows = [top + 14, top + 54, top + 94];
  rows.forEach((y, r) => {
    [x + 18, x + 74].forEach((wx, c) => {
      const lit = hash(seed, r, c) > 0.45;
      windows.push(
        <rect
          key={`${r}-${c}`}
          x={wx}
          y={y}
          width={28}
          height={24}
          rx={1}
          fill={lit ? "hsl(38 95% 70%)" : "hsl(222 35% 15%)"}
          fillOpacity={lit ? 0.8 : 1}
          className={lit ? "rl-window" : undefined}
          style={lit ? ({ "--flicker-delay": `${hash(r, c, seed) * 7}s` } as CSSProperties) : undefined}
        />,
      );
    });
  });
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill="hsl(224 38% 11%)" stroke="hsl(220 28% 30%)" strokeWidth={1} />
      <rect x={x - 4} y={top - 5} width={w + 8} height={6} fill="hsl(222 32% 16%)" />
      {windows}
      {/* door + stoop */}
      <rect x={x + 50} y={GROUND - 42} width={20} height={42} rx={1} fill="hsl(222 32% 18%)" />
      <rect x={x + 44} y={GROUND - 6} width={32} height={6} fill="hsl(222 28% 20%)" />
      <circle cx={x + 66} cy={GROUND - 22} r={1.4} fill="hsl(38 95% 70%)" />
    </g>
  );
}

/** Side-by-side sixplex with a gable roof and two entrances. */
function Sixplex({ x, seed }: { x: number; seed: number }) {
  const w = 170;
  const h = 150;
  const top = GROUND - h;
  const windows: JSX.Element[] = [];
  const rows = [top + 16, top + 56, top + 96];
  rows.forEach((y, r) => {
    [x + 16, x + 71, x + 126].forEach((wx, c) => {
      const lit = hash(seed + 3, r, c) > 0.5;
      windows.push(
        <rect
          key={`${r}-${c}`}
          x={wx}
          y={y}
          width={28}
          height={24}
          rx={1}
          fill={lit ? "hsl(38 95% 70%)" : "hsl(222 35% 15%)"}
          fillOpacity={lit ? 0.8 : 1}
          className={lit ? "rl-window" : undefined}
          style={lit ? ({ "--flicker-delay": `${hash(r, seed, c) * 7}s` } as CSSProperties) : undefined}
        />,
      );
    });
  });
  return (
    <g>
      <polygon
        points={`${x - 6},${top} ${x + w / 2},${top - 52} ${x + w + 6},${top}`}
        fill="hsl(223 36% 13%)"
        stroke="hsl(220 28% 30%)"
        strokeWidth={1}
      />
      <rect x={x + w / 2 - 9} y={top - 30} width={18} height={18} rx={1} fill="hsl(38 95% 70%)" fillOpacity={0.55} />
      <rect x={x} y={top} width={w} height={h} fill="hsl(224 38% 11%)" stroke="hsl(220 28% 30%)" strokeWidth={1} />
      {windows}
      <rect x={x + 44} y={GROUND - 40} width={18} height={40} rx={1} fill="hsl(222 32% 18%)" />
      <rect x={x + 108} y={GROUND - 40} width={18} height={40} rx={1} fill="hsl(222 32% 18%)" />
      <rect x={x + 38} y={GROUND - 6} width={30} height={6} fill="hsl(222 28% 20%)" />
      <rect x={x + 102} y={GROUND - 6} width={30} height={6} fill="hsl(222 28% 20%)" />
    </g>
  );
}

/** Two-storey laneway suite tucked between the bigger buildings. */
function Laneway({ x, seed }: { x: number; seed: number }) {
  const w = 62;
  const h = 64;
  const top = GROUND - h;
  const lit = hash(seed, 9, 9) > 0.35;
  return (
    <g>
      <polygon points={`${x - 3},${top} ${x + w / 2},${top - 22} ${x + w + 3},${top}`} fill="hsl(223 36% 13%)" stroke="hsl(220 28% 30%)" strokeWidth={1} />
      <rect x={x} y={top} width={w} height={h} fill="hsl(224 38% 11%)" stroke="hsl(220 28% 30%)" strokeWidth={1} />
      <rect
        x={x + 10}
        y={top + 10}
        width={20}
        height={18}
        rx={1}
        fill={lit ? "hsl(38 95% 70%)" : "hsl(222 35% 15%)"}
        fillOpacity={lit ? 0.8 : 1}
        className={lit ? "rl-window" : undefined}
        style={lit ? ({ "--flicker-delay": `${hash(seed, 1, 2) * 5}s` } as CSSProperties) : undefined}
      />
      <rect x={x + 38} y={GROUND - 32} width={14} height={32} rx={1} fill="hsl(222 32% 18%)" />
    </g>
  );
}

function Tree({ x, r }: { x: number; r: number }) {
  return (
    <g>
      <rect x={x - 1.5} y={GROUND - r * 1.2} width={3} height={r * 1.2} fill="hsl(222 30% 12%)" />
      <circle cx={x} cy={GROUND - r * 1.4} r={r} fill="hsl(200 30% 12%)" />
      <circle cx={x - r * 0.6} cy={GROUND - r * 1.1} r={r * 0.8} fill="hsl(200 30% 11%)" />
      <circle cx={x + r * 0.6} cy={GROUND - r * 1.15} r={r * 0.75} fill="hsl(200 30% 12%)" />
    </g>
  );
}

const STREET: ReadonlyArray<{ kind: "four" | "six" | "lane" | "tree"; x: number; r?: number }> = [
  { kind: "four", x: 20 }, { kind: "tree", x: 165, r: 18 }, { kind: "six", x: 200 },
  { kind: "lane", x: 400 }, { kind: "tree", x: 490, r: 14 }, { kind: "four", x: 520 },
  { kind: "tree", x: 670, r: 20 }, { kind: "six", x: 700 }, { kind: "lane", x: 900 },
  { kind: "four", x: 990 }, { kind: "tree", x: 1135, r: 16 }, { kind: "six", x: 1160 },
  { kind: "lane", x: 1360 }, { kind: "tree", x: 1440, r: 18 }, { kind: "four", x: 1460 },
  { kind: "six", x: 1610 }, { kind: "tree", x: 1810, r: 18 }, { kind: "lane", x: 1830 },
];

interface SkylineProps {
  /** Scroll progress of the hero, 0 at top, 1 when it has scrolled away. */
  progress: MotionValue<number>;
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Renders the three layers stacked at the bottom of its container. The
 * container must be `relative` and clip overflow. Each layer is a full-width
 * SVG that is slightly wider than the container so lateral drift never shows
 * a bare edge.
 */
export function Skyline({ progress, reduceMotion = false, className = "" }: SkylineProps) {
  // Slower layers lag the page (positive y), the street leads it (negative y).
  const farY = useTransform(progress, [0, 1], [0, 140]);
  const midY = useTransform(progress, [0, 1], [0, 70]);
  const frontY = useTransform(progress, [0, 1], [0, -40]);
  const frontX = useTransform(progress, [0, 1], [0, -60]);
  const still = { y: 0, x: 0 };

  // Each layer keeps its own aspect ratio (no `slice` cropping) and is centred
  // in a wrapper so framer's x/y transforms don't fight a centring transform.
  // Wider-than-container layers push the towers up beside the product frame;
  // the clamp keeps the scene legible on phones and stops it climbing behind
  // the headline on ultrawide screens.
  const wrap = "absolute bottom-0 left-1/2 -translate-x-1/2";

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .rl-window { animation: rl-flicker 6s ease-in-out var(--flicker-delay, 0s) infinite; }
        }
        @keyframes rl-flicker {
          0%, 100% { opacity: 1; }
          47% { opacity: 1; }
          50% { opacity: 0.55; }
          53% { opacity: 1; }
        }
      `}</style>

      {/* Horizon glow — the brand red pushed way down into a sunset. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 100%, hsl(356 100% 60% / 0.22), transparent 70%), radial-gradient(ellipse 40% 40% at 30% 100%, hsl(16 100% 60% / 0.12), transparent 70%)",
        }}
      />

      {/* Far skyline */}
      <div className={`${wrap} w-[clamp(1900px,170%,2600px)] opacity-80`}>
        <motion.svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMax meet"
          className="block w-full will-change-transform"
          style={reduceMotion ? still : { y: farY }}
        >
          {FAR.map(([x, w, h], i) => (
            <g key={i}>
              <rect x={x} y={GROUND - h} width={w} height={h} fill="hsl(222 32% 24%)" />
              {h > 280 && <rect x={x + w / 2 - 1} y={GROUND - h - 26} width={2} height={26} fill="hsl(222 32% 27%)" />}
            </g>
          ))}
          {/* CN Tower */}
          <g fill="hsl(222 32% 26%)">
            <rect x={556} y={40} width={12} height={GROUND - 40} />
            <ellipse cx={562} cy={135} rx={30} ry={13} />
            <ellipse cx={562} cy={112} rx={18} ry={8} />
            <rect x={561} y={0} width={2} height={48} />
          </g>
          <circle cx={562} cy={4} r={2} fill="hsl(356 100% 65%)" className="rl-window" />
        </motion.svg>
      </div>

      {/* Mid-rise band */}
      <div className={`${wrap} w-[clamp(1500px,135%,2100px)]`}>
        <motion.svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMax meet"
          className="block w-full will-change-transform"
          style={reduceMotion ? still : { y: midY }}
        >
          {MID.map(([x, w, h], i) => (
            <g key={i}>
              <rect x={x} y={GROUND - h} width={w} height={h} fill="hsl(223 36% 15%)" />
              <MidWindows x={x} w={w} h={h} index={i} />
            </g>
          ))}
        </motion.svg>
      </div>

      {/* Street of plexes (in front). Wider than the viewBox so lateral drift
          never exposes a bare edge. */}
      <div className={`${wrap} w-[clamp(1200px,105%,1700px)]`}>
        <motion.svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMax meet"
          className="block w-full will-change-transform"
          style={reduceMotion ? still : { y: frontY, x: frontX }}
        >
          <g transform="translate(-120 0)">
            {STREET.map((item, i) =>
              item.kind === "four" ? (
                <Fourplex key={i} x={item.x} seed={i} />
              ) : item.kind === "six" ? (
                <Sixplex key={i} x={item.x} seed={i} />
              ) : item.kind === "lane" ? (
                <Laneway key={i} x={item.x} seed={i} />
              ) : (
                <Tree key={i} x={item.x} r={item.r ?? 16} />
              ),
            )}
            {/* sidewalk + road */}
            <rect x={-200} y={GROUND - 2} width={W + 600} height={2} fill="hsl(220 25% 26%)" />
          </g>
        </motion.svg>
      </div>

      {/* Ground mist so the scene dissolves into the page instead of ending on a line. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[34%]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.6) 40%, transparent 100%)" }}
      />
    </div>
  );
}
